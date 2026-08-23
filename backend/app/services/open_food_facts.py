import asyncio
import platform
import json
import logging
import math
import shutil
import subprocess
from typing import Any

from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError as UrllibHTTPError, URLError

import httpx

from app.schemas import FoodSearchResult

logger = logging.getLogger(__name__)

OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
REQUEST_HEADERS = {
    "User-Agent": "CalorieApp/0.1 (MVP; backend-food-search)",
    "Accept": "application/json",
}

# HTTP status codes considered transient/retryable upstream failures.
_RETRYABLE_STATUS_CODES = {502, 503, 504}
_PRIMARY_TIMEOUT_SECONDS = 10.0
_PRIMARY_MAX_ATTEMPTS = 3
_PRIMARY_RETRY_BASE_DELAY_SECONDS = 0.35
_FALLBACK_MAX_ATTEMPTS = 2
_FALLBACK_RETRY_BASE_DELAY_SECONDS = 0.5
_OPEN_FOOD_FACTS_FIELDS = (
    "product_name,code,image_front_url,image_url,image_small_url,image_front_small_url,"
    "brands,serving_size,nutriscore_grade,nutriments"
)


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


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        result = float(value)
        if not math.isfinite(result):
            return 0.0
        return round(result, 2)
    except (TypeError, ValueError):
        return 0.0


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
    params = {
        "search_terms": safe_query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": page_size,
        "fields": _OPEN_FOOD_FACTS_FIELDS,
    }

    payload: dict[str, Any]
    try:
        payload = await _fetch_primary(params)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "Primary Open Food Facts request failed for query=%r after retries; using fallback: %s",
            safe_query,
            exc,
        )
        try:
            payload = await _fetch_fallback(params)
        except ValueError as exc:
            logger.error("Open Food Facts fallback failed for query=%r: %s", safe_query, exc)
            raise httpx.HTTPError(f"Open Food Facts fallback failed: {exc}") from exc

    results: list[FoodSearchResult] = []
    for product in payload.get("products", []):
        raw_product_name = (product.get("product_name") or "").strip()
        product_name = _repair_common_mojibake(raw_product_name)
        if not product_name:
            continue

        nutriments = product.get("nutriments") or {}
        results.append(
            FoodSearchResult(
                product_name=product_name,
                calories=_to_float(nutriments.get("energy-kcal_100g")),
                protein=_to_float(nutriments.get("proteins_100g")),
                fat=_to_float(nutriments.get("fat_100g")),
                carbohydrates=_to_float(nutriments.get("carbohydrates_100g")),
                image_url=_extract_image_url(product),
                barcode=_to_optional_text(product.get("code")),
                brand=_extract_brand(product),
                serving_size=_to_optional_text(product.get("serving_size")),
                nutri_score=_extract_nutri_score(product),
            )
        )

    return results


async def _fetch_primary(params: dict[str, Any]) -> dict[str, Any]:
    """Fetch from Open Food Facts via httpx with bounded retry/backoff on transient errors."""
    last_exc: httpx.HTTPError | None = None

    for attempt in range(_PRIMARY_MAX_ATTEMPTS):
        try:
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
        except httpx.HTTPStatusError as exc:
            # Only retry on transient server-side status codes.
            if exc.response.status_code in _RETRYABLE_STATUS_CODES and attempt < (_PRIMARY_MAX_ATTEMPTS - 1):
                last_exc = exc
                logger.warning(
                    "Transient HTTP %s from Open Food Facts (attempt %d/%d) — retrying",
                    exc.response.status_code,
                    attempt + 1,
                    _PRIMARY_MAX_ATTEMPTS,
                )
                await asyncio.sleep(_PRIMARY_RETRY_BASE_DELAY_SECONDS * (2 ** attempt))
                continue
            raise
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            # Retry on timeout or connection errors.
            last_exc = exc
            if attempt < (_PRIMARY_MAX_ATTEMPTS - 1):
                logger.warning(
                    "Transient network error from Open Food Facts (attempt %d/%d): %s — retrying",
                    attempt + 1,
                    _PRIMARY_MAX_ATTEMPTS,
                    exc,
                )
                await asyncio.sleep(_PRIMARY_RETRY_BASE_DELAY_SECONDS * (2 ** attempt))
                continue
            raise
        except ValueError as exc:
            # Retry once when JSON payload is malformed or shape is invalid.
            last_exc = httpx.HTTPError(str(exc))
            if attempt < (_PRIMARY_MAX_ATTEMPTS - 1):
                logger.warning(
                    "Primary Open Food Facts payload decode/shape error (attempt %d/%d): %s — retrying",
                    attempt + 1,
                    _PRIMARY_MAX_ATTEMPTS,
                    exc,
                )
                await asyncio.sleep(_PRIMARY_RETRY_BASE_DELAY_SECONDS * (2 ** attempt))
                continue
            raise

    # Defensive guard: every retry path records an exception before continuing.
    if last_exc is None:
        raise RuntimeError("Open Food Facts primary retry loop ended without a result")
    raise last_exc


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
                "-L",
                "--connect-timeout",
                "5",
                "--max-time",
                "15",
                "--retry",
                "1",
                "--retry-delay",
                "1",
                "--retry-connrefused",
                "-H",
                f"User-Agent: {REQUEST_HEADERS['User-Agent']}",
                "-H",
                "Accept: application/json",
                url,
            ],
            check=True,
            capture_output=True,
            timeout=15,
        )
    except FileNotFoundError as exc:
        raise ValueError(f"{curl_cmd} not found on system; please ensure curl is installed") from exc
    except subprocess.TimeoutExpired as exc:
        raise ValueError("curl request timed out") from exc
    except subprocess.CalledProcessError as exc:
        stderr_text = (exc.stderr or b"").decode("utf-8", errors="replace").strip()
        if stderr_text:
            raise ValueError(
                f"curl command failed (exit {exc.returncode}): {stderr_text}"
            ) from exc
        raise ValueError(f"curl command failed (exit {exc.returncode})") from exc
    
    # Decode subprocess bytes explicitly to avoid Windows locale mojibake.
    response_text = completed.stdout.decode("utf-8", errors="replace")
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


def _urllib_fetch(params: dict[str, Any]) -> dict[str, Any]:
    """Portable fallback using Python stdlib only (no external binaries required)."""
    query_string = urlencode(params)
    url = f"{OPEN_FOOD_FACTS_SEARCH_URL}?{query_string}"
    request = Request(url, headers=REQUEST_HEADERS)
    try:
        with urlopen(request, timeout=15) as response:
            response_bytes = response.read()
    except UrllibHTTPError as exc:
        raise ValueError(f"urllib request failed with HTTP {exc.code}") from exc
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
    """Use curl when available; otherwise use a portable Python fallback."""
    if _resolve_curl_command():
        try:
            return await asyncio.to_thread(_curl_fetch, params)
        except ValueError as exc:
            logger.warning("curl fallback failed; trying urllib fallback: %s", exc)

    last_exc: ValueError | None = None
    for attempt in range(_FALLBACK_MAX_ATTEMPTS):
        try:
            return await asyncio.to_thread(_urllib_fetch, params)
        except ValueError as exc:
            last_exc = exc
            if _is_retryable_urllib_error(exc) and attempt < (_FALLBACK_MAX_ATTEMPTS - 1):
                logger.warning(
                    "urllib fallback transient failure (attempt %d/%d): %s — retrying",
                    attempt + 1,
                    _FALLBACK_MAX_ATTEMPTS,
                    exc,
                )
                await asyncio.sleep(_FALLBACK_RETRY_BASE_DELAY_SECONDS * (2 ** attempt))
                continue
            raise

    if last_exc is None:
        raise RuntimeError("Open Food Facts fallback retry loop ended without a result")
    raise last_exc


def _is_retryable_urllib_error(exc: ValueError) -> bool:
    msg = str(exc)
    if any(f"HTTP {status}" in msg for status in _RETRYABLE_STATUS_CODES):
        return True
    lowered = msg.lower()
    return "timed out" in lowered or "temporarily unavailable" in lowered or "urlopen error" in lowered
