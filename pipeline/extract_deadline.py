from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from .models import DeadlineInfo

APPLY_HINTS = re.compile(
    r"(deadline|closing date|apply by|application deadline|registration closes|"
    r"submit by|due on|報名至|報名截止|申請截止|截止日期|截止報名|截至|截止)",
    re.I,
)
ROLLING_HINTS = re.compile(
    r"(rolling basis|until filled|until positions? are filled|until further notice|"
    r"長期招募|額滿即止|直至額滿)",
    re.I,
)
ISO_RE = re.compile(r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})")
DMY_RE = re.compile(
    r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"(?:\s+(20\d{2}))?",
    re.I,
)
CN_RE = re.compile(r"(?:(20\d{2})\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]")
MONTHS = {
    m.lower(): i
    for i, m in enumerate(
        [
            "", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]
    )
    if m
}


def _valid(year: int, month: int, day: int) -> str | None:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _parse_in_chunk(chunk: str, year: int) -> tuple[str | None, str]:
    if m := ISO_RE.search(chunk):
        value = _valid(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if value:
            return value, m.group(0)
    if m := DMY_RE.search(chunk):
        value = _valid(int(m.group(3) or year), MONTHS[m.group(2).lower()], int(m.group(1)))
        if value:
            return value, m.group(0)
    if m := CN_RE.search(chunk):
        value = _valid(int(m.group(1) or year), int(m.group(2)), int(m.group(3)))
        if value:
            return value, m.group(0)
    return None, ""


def _dateparser_search(text: str, digest_iso: str) -> tuple[str | None, str]:
    try:
        from dateparser.search import search_dates
    except Exception:
        return None, ""
    settings = {
        "PREFER_DATES_FROM": "future",
        "RELATIVE_BASE": datetime.fromisoformat(digest_iso),
        "RETURN_AS_TIMEZONE_AWARE": False,
    }
    try:
        hits = search_dates(text, languages=["en", "zh"], settings=settings) or []
    except Exception:
        return None, ""
    digest = date.fromisoformat(digest_iso)
    for fragment, dt in hits:
        if not isinstance(dt, datetime):
            continue
        d = dt.date()
        # Prefer dates from digest day to ~1 year ahead.
        if d < digest - timedelta(days=1) or d > digest + timedelta(days=400):
            continue
        idx = text.lower().find(fragment.lower())
        if idx < 0:
            continue
        nearby = text[max(0, idx - 60) : idx + len(fragment) + 60]
        # Only accept dateparser hits inside an apply/deadline context.
        # Event-only dates must not become application deadlines.
        if APPLY_HINTS.search(nearby) or APPLY_HINTS.search(fragment):
            return d.isoformat(), fragment.strip()
    return None, ""


def extract_deadline(text: str, digest_date: str) -> DeadlineInfo:
    """Extract application deadline with kind + evidence."""
    digest_iso = (
        digest_date
        if "-" in digest_date
        else f"{digest_date[:4]}-{digest_date[4:6]}-{digest_date[6:]}"
    )
    year = int(digest_iso[:4])

    if ROLLING_HINTS.search(text):
        m = ROLLING_HINTS.search(text)
        return DeadlineInfo(
            date=None,
            kind="rolling",
            confidence="medium",
            evidence=(m.group(0) if m else "rolling"),
        )

    window_re = re.compile(
        r"(?:deadline|closing date|apply by|application deadline|registration closes|"
        r"register by|submit by|due on|due date|last day to apply|"
        r"報名至|報名截止|申請截止|截止日期|截止報名|截至|截止|請於)[^\n。.!?]{0,120}",
        re.I,
    )
    windows = window_re.findall(text)
    # Also scan short lines that look like apply instructions followed by a date.
    for line in text.splitlines():
        if re.search(r"\b(apply|register|deadline|報名|申請|截止)\b", line, re.I) and re.search(
            r"20\d{2}|\d{1,2}\s+[A-Za-z]+|\d{1,2}\s*月", line
        ):
            windows.append(line.strip())
    for chunk in windows:
        value, evidence = _parse_in_chunk(chunk, year)
        if value:
            return DeadlineInfo(date=value, kind="apply", confidence="high", evidence=chunk.strip()[:160])

    value, evidence = _dateparser_search(text[:6000], digest_iso)
    if value and evidence:
        return DeadlineInfo(date=value, kind="apply", confidence="medium", evidence=evidence[:160])

    return DeadlineInfo(date=None, kind="unknown", confidence="low", evidence="")
