import asyncio
import platform
import json
import logging
import math
import re
import shutil
import subprocess
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError as UrllibHTTPError, URLError

import httpx

from app.database import engine
from app.provider_rate_governor import build_provider_rate_governor
from app.schemas import FoodSearchResult
from app.services.food_search_availability import (
    FoodSearchAvailability,
    FoodSearchUnavailable,
    provider_retry_seconds,
)
from app.source_admission import (
    AdapterAdmissionController,
    AdapterAdmissionRejected,
    DuplicateRequestCoalescer,
)

logger = logging.getLogger(__name__)
T = TypeVar("T")

OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
REQUEST_HEADERS = {
    "User-Agent": "CalorieApp/0.2.0 (https://calorietoken.net; info@calorietoken.net)",
    "Accept": "application/json",
}

_PRIMARY_TIMEOUT_SECONDS = 10.0
# One normal request plus at most one alternate-transport request. Nested
# transport retries would amplify one user search into enough upstream traffic
# to exhaust Open Food Facts' public per-IP search allowance.
_PRIMARY_MAX_ATTEMPTS = 1
_FALLBACK_MAX_ATTEMPTS = 1
_MAX_UPSTREAM_ATTEMPTS_PER_SEARCH = _PRIMARY_MAX_ATTEMPTS + _FALLBACK_MAX_ATTEMPTS
_OPEN_FOOD_FACTS_FIELDS = (
    "product_name,code,image_front_url,image_url,image_small_url,image_front_small_url,"
    "brands,serving_size,nutriscore_grade,nutriments"
)

_OPEN_FOOD_FACTS_ADMISSION = AdapterAdmissionController(
    max_concurrency=2,
    max_queue=4,
    queue_timeout_seconds=2.0,
    failure_threshold=3,
    recovery_timeout_seconds=30.0,
)
_OPEN_FOOD_FACTS_COALESCER: DuplicateRequestCoalescer[list[FoodSearchResult]] = (
    DuplicateRequestCoalescer()
)
_OPEN_FOOD_FACTS_RATE_GOVERNOR = build_provider_rate_governor(engine)
_OPEN_FOOD_FACTS_AVAILABILITY = FoodSearchAvailability()


async def _governed_attempt(operation: Callable[[], Awaitable[T]]) -> T:
    """Reserve shared egress capacity immediately before an upstream attempt."""
    _OPEN_FOOD_FACTS_AVAILABILITY.check_provider()
    await _OPEN_FOOD_FACTS_RATE_GOVERNOR.acquire()
    return await operation()


def _repair_common_mojibake(text: str) -> str:
    if not text:
        return ""

    marker_count = text.count("Ã") + text.count("Â")
    if marker_count == 0:
        return text

    for source_encoding in ("latin-1", "cp1252"):
        try:
            repaired = text.encode(source_encoding).decode("utf-8")
        except UnicodeError:
            continue

        repaired_marker_count = repaired.count("Ã") + repaired.count("Â")
        if repaired_marker_count < marker_count:
            return repaired

    return text


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
        if not math.isfinite(result):
            return None
        if result < 0:
            return None
        return round(result, 2)
    except (TypeError, ValueError):
        return None


def _to_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _extract_image_url(product: dict[str, Any]) -> str | None:
    """Prefer higher-quality Open Food Facts image fields when available."""
    for key in ("image_front_url", "image_url", "image_small_url", "image_front_small_url"):
        image_url = _to_optional_text(product.get(key))
        if image_url:
            return image_url
    return None


def _extract_brand(product: dict[str, Any]) -> str | None:
    brands = _to_optional_text(product.get("brands"))
    if not brands:
        return None
    # Open Food Facts often returns comma-separated brands; show the first clean label.
    first_brand = brands.split(",", 1)[0].strip()
    return first_brand or None


def _extract_nutri_score(product: dict[str, Any]) -> str | None:
    value = _to_optional_text(product.get("nutriscore_grade"))
    if not value:
        return None
    normalized = value.upper()
    return normalized if normalized in {"A", "B", "C", "D", "E"} else None


async def search_food_products(query: str, page_size: int = 10) -> list[FoodSearchResult]:
    safe_query = query.strip()
    cached = _OPEN_FOOD_FACTS_AVAILABILITY.get(safe_query, page_size)
    if cached is not None:
        return cached
    _OPEN_FOOD_FACTS_AVAILABILITY.check_provider()
    return await _OPEN_FOOD_FACTS_COALESCER.run(
        (safe_query, page_size),
        lambda: _search_food_products_once(safe_query, page_size),
    )


async def _search_food_products_once(
    safe_query: str,
    page_size: int,
) -> list[FoodSearchResult]:
    permit = _OPEN_FOOD_FACTS_ADMISSION.begin_action()
    params = {
        "search_terms": safe_query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": page_size,
        "fields": _OPEN_FOOD_FACTS_FIELDS,
    }

    try:
        try:
            payload = await _OPEN_FOOD_FACTS_ADMISSION.run_attempt(
                lambda: _governed_attempt(lambda: _fetch_primary(params))
            )
        except httpx.HTTPStatusError:
            # Do not bypass an upstream status (especially 429/503) through
            # another transport. That would multiply load precisely when the
            # source asks us to stop or is unavailable.
            raise
        except (httpx.RequestError, ValueError) as exc:
            logger.warning(
                "Primary Open Food Facts request failed; using fallback (%s)",
                type(exc).__name__,
            )
            try:
                payload = await _OPEN_FOOD_FACTS_ADMISSION.run_attempt(
                    lambda: _governed_attempt(lambda: _fetch_fallback(params))
                )
            except ValueError as fallback_exc:
                logger.error(
                    "Open Food Facts fallback failed (%s)",
                    type(fallback_exc).__name__,
                )
                raise httpx.HTTPError(
                    f"Open Food Facts fallback failed: {fallback_exc}"
                ) from fallback_exc

        results = _normalize_products(payload)
    except httpx.HTTPStatusError as exc:
        _OPEN_FOOD_FACTS_ADMISSION.record_failure(permit)
        if exc.response.status_code in {429, 503}:
            seconds = provider_retry_seconds(exc.response.headers.get("Retry-After"))
            _OPEN_FOOD_FACTS_AVAILABILITY.pause_provider(exc.response.status_code, seconds)
            raise FoodSearchUnavailable(exc.response.status_code, seconds) from exc
        raise
    except AdapterAdmissionRejected:
        if permit.half_open_probe:
            _OPEN_FOOD_FACTS_ADMISSION.record_failure(permit)
        raise
    except asyncio.CancelledError:
        if permit.half_open_probe:
            _OPEN_FOOD_FACTS_ADMISSION.record_failure(permit)
        raise
    except Exception:
        _OPEN_FOOD_FACTS_ADMISSION.record_failure(permit)
        raise
    else:
        _OPEN_FOOD_FACTS_ADMISSION.record_success(permit)
        _OPEN_FOOD_FACTS_AVAILABILITY.remember(safe_query, page_size, results)
        return results


def _normalize_products(payload: dict[str, Any]) -> list[FoodSearchResult]:
    results: list[FoodSearchResult] = []
    for product in payload.get("products", []):
        raw_product_name = (product.get("product_name") or "").strip()
        product_name = _repair_common_mojibake(raw_product_name)
        if not product_name:
            continue

        nutriments = product.get("nutriments") or {}
        nutrition = {
            "calories": _to_float(nutriments.get("energy-kcal_100g")),
            "protein": _to_float(nutriments.get("proteins_100g")),
            "fat": _to_float(nutriments.get("fat_100g")),
            "carbohydrates": _to_float(nutriments.get("carbohydrates_100g")),
        }

        # A missing value is not the same as a measured zero. Incomplete
        # records are excluded from loggable search results so CalorieApp cannot
        # silently turn unknown nutrition into a misleading 0.0 value.
        if any(value is None for value in nutrition.values()):
            continue

        results.append(
            FoodSearchResult(
                product_name=product_name,
                calories=nutrition["calories"],
                protein=nutrition["protein"],
                fat=nutrition["fat"],
                carbohydrates=nutrition["carbohydrates"],
                image_url=_extract_image_url(product),
                barcode=_to_optional_text(product.get("code")),
                brand=_extract_brand(product),
                serving_size=_to_optional_text(product.get("serving_size")),
                nutri_score=_extract_nutri_score(product),
            )
        )

    return results


async def _fetch_primary(params: dict[str, Any]) -> dict[str, Any]:
    """Make one primary Open Food Facts request; the caller owns fallback policy."""
    async with httpx.AsyncClient(timeout=_PRIMARY_TIMEOUT_SECONDS) as client:
        response = await client.get(
            OPEN_FOOD_FACTS_SEARCH_URL,
            params=params,
            headers=REQUEST_HEADERS,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Open Food Facts payload is not a JSON object")
        products = payload.get("products")
        if products is None:
            payload["products"] = []
        elif not isinstance(products, list):
            raise ValueError("Open Food Facts payload 'products' field is not a list")
        return payload


def _curl_fetch(params: dict[str, Any]) -> dict[str, Any]:
    query_string = urlencode(params)
    url = f"{OPEN_FOOD_FACTS_SEARCH_URL}?{query_string}"

    curl_cmd = _resolve_curl_command()
    if not curl_cmd:
        raise ValueError("curl command not available on this system")

    try:
        completed = subprocess.run(
            [
                curl_cmd,
                "--silent",
                "--show-error",
                "--fail",
                "--dump-header",
                "-",
                "--write-out",
                "\n%{http_code}",
                "-L",
                "--connect-timeout",
                "5",
                "--max-time",
                "15",
                "-H",
                f"User-Agent: {REQUEST_HEADERS['User-Agent']}",
                "-H",
                "Accept: application/json",
                url,
            ],
            check=False,
            capture_output=True,
            timeout=15,
        )
    except FileNotFoundError as exc:
        raise ValueError(f"{curl_cmd} not found on system; please ensure curl is installed") from exc
    except subprocess.TimeoutExpired as exc:
        raise ValueError("curl request timed out") from exc
    response_bytes, separator, status_bytes = completed.stdout.rpartition(b"\n")
    if not separator or not re.fullmatch(rb"\d{3}", status_bytes):
        raise ValueError("curl response is missing its HTTP status")
    status_code = int(status_bytes)
    response_headers: dict[str, str] = {}
    # curl can print CONNECT and redirect headers before the final response.
    # Keep only the final headers, and keep all transfer data in memory.
    while response_bytes.startswith(b"HTTP/"):
        parts = re.split(rb"\r?\n\r?\n", response_bytes, maxsplit=1)
        if len(parts) != 2:
            raise ValueError("curl response headers are incomplete")
        header_block, response_bytes = parts
        response_headers = {}
        for line in header_block.splitlines()[1:]:
            key, colon, value = line.partition(b":")
            if colon and key.lower() == b"retry-after":
                response_headers["Retry-After"] = value.decode("ascii", errors="replace").strip()
    if status_code >= 400:
        _raise_fallback_http_status(status_code, response_headers.get("Retry-After"))
    if completed.returncode != 0:
        raise ValueError(f"curl transport failed (exit {completed.returncode})")

    # Decode subprocess bytes explicitly to avoid Windows locale mojibake.
    response_text = response_bytes.decode("utf-8", errors="replace")
    if not response_text.strip():
        raise ValueError("curl returned empty response")
    try:
        payload = json.loads(response_text)
        if not isinstance(payload, dict):
            raise ValueError("curl payload is not a JSON object")
        products = payload.get("products")
        if products is None:
            payload["products"] = []
        elif not isinstance(products, list):
            raise ValueError("curl payload 'products' field is not a list")
        return payload
    except json.JSONDecodeError as exc:
        raise ValueError(f"curl returned invalid JSON: {exc}") from exc


def _resolve_curl_command() -> str | None:
    """Return an available curl executable or None when unavailable."""
    if platform.system() == "Windows":
        return shutil.which("curl.exe") or shutil.which("curl")
    return shutil.which("curl")


def _raise_fallback_http_status(status_code: int, retry_after: str | None) -> None:
    # Preserve status and Retry-After through the same handler as httpx, without
    # attaching private query text or copying the provider's response body.
    request = httpx.Request("GET", OPEN_FOOD_FACTS_SEARCH_URL)
    response = httpx.Response(
        status_code,
        request=request,
        headers={"Retry-After": retry_after} if retry_after else {},
    )
    response.raise_for_status()


def _urllib_fetch(params: dict[str, Any]) -> dict[str, Any]:
    """Portable fallback using Python stdlib only (no external binaries required)."""
    query_string = urlencode(params)
    url = f"{OPEN_FOOD_FACTS_SEARCH_URL}?{query_string}"
    request = Request(url, headers=REQUEST_HEADERS)
    try:
        with urlopen(request, timeout=15) as response:
            response_bytes = response.read()
    except UrllibHTTPError as exc:
        _raise_fallback_http_status(
            exc.code, exc.headers.get("Retry-After") if exc.headers else None
        )
        raise ValueError("urllib returned an unexpected status") from exc
    except (URLError, TimeoutError) as exc:
        raise ValueError(f"urllib request failed: {exc}") from exc

    response_text = response_bytes.decode("utf-8", errors="replace")
    if not response_text.strip():
        raise ValueError("urllib returned empty response")
    try:
        payload = json.loads(response_text)
        if not isinstance(payload, dict):
            raise ValueError("urllib payload is not a JSON object")
        products = payload.get("products")
        if products is None:
            payload["products"] = []
        elif not isinstance(products, list):
            raise ValueError("urllib payload 'products' field is not a list")
        return payload
    except json.JSONDecodeError as exc:
        raise ValueError(f"urllib returned invalid JSON: {exc}") from exc


async def _fetch_fallback(params: dict[str, Any]) -> dict[str, Any]:
    """Make one alternate-transport attempt without nested retry amplification."""
    if _resolve_curl_command():
        return await asyncio.to_thread(_curl_fetch, params)
    return await asyncio.to_thread(_urllib_fetch, params)
