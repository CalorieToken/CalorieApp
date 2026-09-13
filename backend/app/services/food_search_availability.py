"""Short-lived public search results and provider-directed cooldowns."""

import hashlib
import math
import time
from collections import OrderedDict
from collections.abc import Callable
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from threading import Lock

from app.schemas import FoodSearchResult


DEFAULT_PROVIDER_RETRY_SECONDS = 30


def provider_retry_seconds(value: str | None) -> int:
    """Honor Retry-After without treating a missing header as immediate retry."""
    if value:
        value = value.strip()
        if value.isascii() and value.isdigit() and len(value) <= 10:
            return max(1, int(value))
        try:
            retry_at = parsedate_to_datetime(value)
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=UTC)
            seconds = math.ceil((retry_at - datetime.now(UTC)).total_seconds())
            if seconds > 0:
                return seconds
        except (TypeError, ValueError, OverflowError):
            pass
    return DEFAULT_PROVIDER_RETRY_SECONDS


class FoodSearchUnavailable(Exception):
    """A provider status safe to expose without request text or response bodies."""

    def __init__(self, status_code: int, retry_after_seconds: int) -> None:
        super().__init__("Food search temporarily unavailable")
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


class FoodSearchAvailability:
    def __init__(
        self,
        *,
        max_entries: int = 256,
        ttl_seconds: float = 3600,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._lock = Lock()
        self._cache: OrderedDict[bytes, tuple[float, list[FoodSearchResult]]] = OrderedDict()
        self._retry_at = 0.0
        self._status_code = 503

    @staticmethod
    def _key(query: str, page_size: int, barcode: bool = False) -> bytes:
        return hashlib.sha256(f"{barcode}\0{page_size}\0{query}".encode("utf-8")).digest()

    def _expire(self, now: float) -> None:
        for key, (expires_at, _) in list(self._cache.items()):
            if expires_at <= now:
                del self._cache[key]

    def get(self, query: str, page_size: int, *, barcode: bool = False) -> list[FoodSearchResult] | None:
        with self._lock:
            self._expire(self.clock())
            key = self._key(query, page_size, barcode)
            entry = self._cache.get(key)
            if entry is None:
                return None
            self._cache.move_to_end(key)
            return [item.model_copy(deep=True) for item in entry[1]]

    def remember(self, query: str, page_size: int, results: list[FoodSearchResult], *, barcode: bool = False) -> None:
        # Do not turn a transient empty provider response into a cached absence.
        if not results:
            return
        with self._lock:
            now = self.clock()
            self._expire(now)
            key = self._key(query, page_size, barcode)
            self._cache[key] = (
                now + self.ttl_seconds,
                [item.model_copy(deep=True) for item in results],
            )
            self._cache.move_to_end(key)
            while len(self._cache) > self.max_entries:
                self._cache.popitem(last=False)

    def check_provider(self) -> None:
        with self._lock:
            remaining = math.ceil(self._retry_at - self.clock())
            if remaining > 0:
                raise FoodSearchUnavailable(self._status_code, remaining)

    def pause_provider(self, status_code: int, seconds: int) -> None:
        with self._lock:
            retry_at = self.clock() + seconds
            # An overlapping request must never shorten a provider's pause.
            if retry_at >= self._retry_at:
                self._retry_at = retry_at
                self._status_code = status_code

    def reset(self) -> None:
        """Clear process-local state for isolated tests."""
        with self._lock:
            self._cache.clear()
            self._retry_at = 0.0
            self._status_code = 503
