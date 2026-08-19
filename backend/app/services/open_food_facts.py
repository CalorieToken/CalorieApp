import asyncio
import json
import logging
import subprocess
from typing import Any

from urllib.parse import urlencode

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
_PRIMARY_RETRY_DELAY_SECONDS = 0.35


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
        return round(result, 2)
    except (TypeError, ValueError):
        return 0.0


async def search_food_products(query: str, page_size: int = 10) -> list[FoodSearchResult]:
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": page_size,
    }

    safe_query = query.strip()
    payload: dict[str, Any]
    try:
        payload = await _fetch_primary(params)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "Primary Open Food Facts request failed for query=%r after retry; using curl fallback: %s",
            safe_query,
            exc,
        )
        try:
            payload = await _fetch_with_curl(params)
        except (ValueError, Exception) as exc:
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
            )
        )

    return results


async def _fetch_primary(params: dict[str, Any]) -> dict[str, Any]:
    """Fetch from Open Food Facts via httpx with one transparent retry on transient errors."""
    last_exc: httpx.HTTPError | None = None

    for attempt in range(2):  # attempt 0 = first try, attempt 1 = single retry
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
            if exc.response.status_code in _RETRYABLE_STATUS_CODES and attempt == 0:
                last_exc = exc
                logger.warning(
                    "Transient HTTP %s from Open Food Facts (attempt %d) — retrying",
                    exc.response.status_code,
                    attempt + 1,
                )
                await asyncio.sleep(_PRIMARY_RETRY_DELAY_SECONDS)
                continue
            raise
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            # Retry once on timeout or connection errors.
            last_exc = exc
            if attempt == 0:
                logger.warning(
                    "Transient network error from Open Food Facts (attempt %d): %s — retrying",
                    attempt + 1,
                    exc,
                )
                await asyncio.sleep(_PRIMARY_RETRY_DELAY_SECONDS)
                continue
            raise
        except ValueError as exc:
            # Retry once when JSON payload is malformed or shape is invalid.
            last_exc = httpx.HTTPError(str(exc))
            if attempt == 0:
                logger.warning(
                    "Primary Open Food Facts payload decode/shape error (attempt %d): %s — retrying",
                    attempt + 1,
                    exc,
                )
                await asyncio.sleep(_PRIMARY_RETRY_DELAY_SECONDS)
                continue
            raise

    # Should only be reached if both attempts raised a retryable exception.
    raise last_exc  # type: ignore[misc]


def _curl_fetch(params: dict[str, Any]) -> dict[str, Any]:
    query_string = urlencode(params)
    url = f"{OPEN_FOOD_FACTS_SEARCH_URL}?{query_string}"

    try:
        completed = subprocess.run(
            [
                "curl.exe",
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
        raise ValueError("curl.exe not found on system") from exc
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


async def _fetch_with_curl(params: dict[str, Any]) -> dict[str, Any]:
    return await asyncio.to_thread(_curl_fetch, params)
