from __future__ import annotations

from datetime import UTC, datetime

from .clean import clean_body, strip_decorative_emoji
from .extract_deadline import extract_deadline
from .extract_fields import extract_compensation, extract_requirements
from .extract_schedule import extract_schedule
from .extract_summary import extract_key_phrases, extract_summary, is_redundant_summary
from .extract_taxonomy import extract_taxonomy
from .models import MailItem, Taxonomy


def enrich_item(
    *,
    id: str,
    digest_date: str,
    category: str,
    title: str,
    body_text: str,
    source_url: str,
    application_urls: list[str] | None = None,
    organizer: str | None = None,
    contact_email: str | None = None,
    published_at: str | None = None,
    fetched_at: str | None = None,
    source: str = "digest",
) -> MailItem:
    digest_iso = digest_date if "-" in digest_date else f"{digest_date[:4]}-{digest_date[4:6]}-{digest_date[6:]}"
    fetched_at = fetched_at or datetime.now(UTC).isoformat().replace("+00:00", "Z")
    published_at = published_at or f"{digest_iso}T00:00:00+08:00"
    clean_title = strip_decorative_emoji(title)
    cleaned = clean_body(body_text)
    working = cleaned or body_text
    summary, evidence = extract_summary(working)
    if is_redundant_summary(clean_title, summary):
        summary, evidence = "", []
    deadline = extract_deadline(working, digest_iso)
    taxonomy = extract_taxonomy(clean_title, working)
    tags = _tags_from_taxonomy(taxonomy)
    phrases = extract_key_phrases(f"{clean_title}\n{working}")
    time_marks = extract_schedule(working, digest_iso, published_at=published_at)
    return MailItem(
        id=id,
        digestDate=digest_iso,
        category=category,
        title=clean_title,
        bodyText=strip_decorative_emoji(body_text)[:30000],
        cleanBody=working[:20000],
        summary=summary,
        summaryEvidence=evidence,
        organizer=organizer,
        contactEmail=contact_email,
        sourceUrl=source_url,  # type: ignore[arg-type]
        applicationUrls=application_urls or [],  # type: ignore[arg-type]
        deadline=deadline.date,
        deadlineKind=deadline.kind,
        deadlineConfidence=deadline.confidence,
        deadlineEvidence=deadline.evidence,
        timeMarks=time_marks,
        compensation=extract_compensation(f"{clean_title}\n{working}"),
        taxonomy=taxonomy,
        tags=tags,
        keyPhrases=phrases,
        requirements=extract_requirements(working),
        publishedAt=published_at,
        fetchedAt=fetched_at,
        source=source if source in {"digest", "import"} else "digest",  # type: ignore[arg-type]
    )


def _tags_from_taxonomy(tax: Taxonomy) -> list[str]:
    labels = {
        "paid_work": "Paid work",
        "research": "Research",
        "event": "Event",
        "programme": "Programme",
        "competition": "Competition",
        "service": "Service",
        "admin": "Notice",
    }
    tags = [labels.get(tax.type, tax.type)]
    tags.extend(tax.domains[:2])
    tags.extend(tax.roles[:1])
    return tags


def reenrich_raw_dict(raw: dict) -> MailItem:
    """Upgrade a legacy feed item (or partial dict) through the new pipeline."""
    return enrich_item(
        id=str(raw["id"]),
        digest_date=str(raw["digestDate"]),
        category=str(raw.get("category") or "Announcements"),
        title=str(raw["title"]),
        body_text=str(raw.get("bodyText") or ""),
        source_url=str(raw["sourceUrl"]),
        application_urls=[str(u) for u in raw.get("applicationUrls") or []],
        organizer=raw.get("organizer"),
        contact_email=raw.get("contactEmail"),
        published_at=raw.get("publishedAt"),
        fetched_at=raw.get("fetchedAt"),
    )
