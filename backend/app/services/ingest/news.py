"""Google News RSS search adapter: recent Gujarat hazard headlines in English, Gujarati and Hindi.

Only the headline, publisher name, publication time and article link are kept. Article bodies
are never fetched. Each headline becomes an unverified signal for a dispatcher to review.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any

import defusedxml.ElementTree as ET
import httpx

from app.services.ingest.base import Adapter
from app.services.ingest.signals import (
    detect_language,
    locate_gujarat_text,
    mentions_hazard,
    sanitise_signal_text,
    stable_uid,
)

logger = logging.getLogger("drch.ingest.news")

FEED_HOST = "news.google.com"
FEED_URL = f"https://{FEED_HOST}/rss/search"
MAX_ITEMS_PER_QUERY = 40
MAX_AGE = timedelta(hours=48)
MAX_RESPONSE_BYTES = 2_000_000
USER_AGENT = "ResQ-DRCH-ingest/1.0"

# One search per language. "when:1d" limits results to the last day.
QUERIES: tuple[tuple[str, str, dict[str, str]], ...] = (
    ("en", "gujarat (flood OR rain OR cyclone OR fire OR blast OR explosion OR \"gas leak\") when:1d",
     {"hl": "en-IN", "gl": "IN", "ceid": "IN:en"}),
    ("gu", "ગુજરાત (પૂર OR વરસાદ OR વાવાઝોડું OR આગ OR વિસ્ફોટ) when:1d",
     {"hl": "gu", "gl": "IN", "ceid": "IN:gu"}),
    ("hi", "गुजरात (बाढ़ OR बारिश OR चक्रवात OR आग OR विस्फोट) when:1d",
     {"hl": "hi", "gl": "IN", "ceid": "IN:hi"}),
)


def _child_text(node: Any, name: str) -> str:
    for child in node:
        if child.tag.split("}")[-1].lower() == name.lower():
            return (child.text or "").strip()
    return ""


def _published(raw: str) -> datetime | None:
    try:
        value = parsedate_to_datetime(raw)
    except (TypeError, ValueError, IndexError):
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def parse_news_rss(xml_text: str, query_lang: str, now: datetime | None = None) -> list[dict[str, Any]]:
    """Turn a Google News RSS document into signal rows (hazard and Gujarat items only)."""
    now = now or datetime.now(UTC)
    root = ET.fromstring(xml_text)
    rows: list[dict[str, Any]] = []
    for item in root.iter("item"):
        title = _child_text(item, "title")
        publisher = _child_text(item, "source")
        # Google appends " - Publisher" to every title; keep the publisher separately.
        if publisher and title.endswith(f" - {publisher}"):
            title = title[: -len(publisher) - 3]
        text = sanitise_signal_text(title)
        if not text or not mentions_hazard(text):
            continue
        location = locate_gujarat_text(text)
        if location is None:
            continue
        published = _published(_child_text(item, "pubDate"))
        if published and now - published > MAX_AGE:
            continue
        guid = _child_text(item, "guid") or _child_text(item, "link") or text
        rows.append({
            "source": "GNEWS",
            "source_uid": stable_uid("gnews", guid),
            "content_text": text,
            "language": detect_language(text),
            "location_text": location["location_text"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "is_simulated": False,
            "raw_payload": {
                "kind": "news_headline",
                "publisher": publisher[:200] or None,
                "published_at": published.isoformat() if published else None,
                "link": _child_text(item, "link")[:1000] or None,
                "query_lang": query_lang,
                "location_precision": "district_centroid" if location["district"] else "none",
            },
        })
        if len(rows) >= MAX_ITEMS_PER_QUERY:
            break
    return rows


class GoogleNewsAdapter(Adapter):
    """Poll Google News RSS search for recent Gujarat hazard headlines."""

    name = "GNEWS"
    kind = "signal"

    def fetch(self) -> list[dict[str, Any]]:
        rows: dict[str, dict[str, Any]] = {}
        failures = 0
        # Google normalises some non-Latin queries with a redirect on the same host; follow it,
        # but never accept a response from any other host.
        with httpx.Client(timeout=15.0, follow_redirects=True, max_redirects=3,
                          headers={"User-Agent": USER_AGENT}) as client:
            for lang, query, params in QUERIES:
                try:
                    response = client.get(FEED_URL, params={"q": query, **params})
                    if response.url.host != FEED_HOST:
                        raise ValueError("News RSS redirected to an unexpected host")
                    response.raise_for_status()
                    if len(response.content) > MAX_RESPONSE_BYTES:
                        raise ValueError("News RSS response exceeded the size limit")
                    for row in parse_news_rss(response.text, lang):
                        rows.setdefault(row["source_uid"], row)
                except (httpx.HTTPError, ValueError, ET.ParseError) as exc:
                    failures += 1
                    logger.warning("News RSS query for %s failed (%s)", lang, type(exc).__name__)
        if failures == len(QUERIES):
            raise RuntimeError("Every news RSS query failed")
        return list(rows.values())
