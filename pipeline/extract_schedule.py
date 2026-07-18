from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from .extract_deadline import APPLY_HINTS, MONTHS, _parse_in_chunk, _valid, extract_deadline
from .models import TimeMark

RANGE_SEP = r"(?:\s*(?:to|until|till|–|—|-|至|到|～|~)\s*|\s*[-–—]\s*)"

EVENT_HINTS = re.compile(
    r"(event date|will be held|takes place|held on|on\s+\d|during\s+\d|"
    r"講座日期|活動日期|舉行|舉辦|活動時間|日期為)",
    re.I,
)
START_HINTS = re.compile(
    r"(project start|start(?:s|ing)?(?:\s+on|\s+from)?|commence|begin(?:s|ning)?|"
    r"from\s+\d|effective(?:\s+from)?|開始|开始|起|起始|開工|开工)",
    re.I,
)
END_HINTS = re.compile(
    r"(project end|end(?:s|ing)?(?:\s+on)?|finish(?:es|ing)?|until\s+\d|"
    r"complete by|結束|结束|完結|完结|終止|终止)",
    re.I,
)
WORK_HINTS = re.compile(
    r"(work(?:ing)? period|employment period|contract period|tenure|"
    r"during\s+\d|from .+ to|任期|工作期間|工作期间|受僱|受雇)",
    re.I,
)

RANGE_DMY = re.compile(
    rf"(\d{{1,2}})\s+(January|February|March|April|May|June|July|August|September|October|November|December)"
    rf"{RANGE_SEP}"
    rf"(\d{{1,2}})\s+(January|February|March|April|May|June|July|August|September|October|November|December)"
    rf"(?:\s+(20\d{{2}}))?",
    re.I,
)
RANGE_ISO = re.compile(
    rf"(20\d{{2}})[-/.](\d{{1,2}})[-/.](\d{{1,2}}){RANGE_SEP}(20\d{{2}})[-/.](\d{{1,2}})[-/.](\d{{1,2}})"
)
RANGE_CN = re.compile(
    rf"(?:(20\d{{2}})\s*年)?\s*(\d{{1,2}})\s*月\s*(\d{{1,2}})\s*[日号號]?{RANGE_SEP}"
    rf"(?:(20\d{{2}})\s*年)?\s*(\d{{1,2}})\s*月\s*(\d{{1,2}})\s*[日号號]"
)
RANGE_SAME_MONTH = re.compile(
    rf"(\d{{1,2}})\s*[-–—to至到～~]+\s*(\d{{1,2}})\s+"
    rf"(January|February|March|April|May|June|July|August|September|October|November|December)"
    rf"(?:\s+(20\d{{2}}))?",
    re.I,
)


def _evidence(text: str, start: int, end: int) -> str:
    return re.sub(r"\s+", " ", text[max(0, start - 24) : min(len(text), end + 40)]).strip()[:160]


def _parse_ranges(text: str, year: int) -> list[tuple[str, str, str, int, int]]:
    """Return list of (start, end, evidence, start_idx, end_idx)."""
    found: list[tuple[str, str, str, int, int]] = []
    for m in RANGE_ISO.finditer(text):
        a = _valid(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        b = _valid(int(m.group(4)), int(m.group(5)), int(m.group(6)))
        if a and b:
            found.append((a, b, m.group(0), m.start(), m.end()))
    for m in RANGE_DMY.finditer(text):
        y = int(m.group(5) or year)
        a = _valid(y, MONTHS[m.group(2).lower()], int(m.group(1)))
        b = _valid(y, MONTHS[m.group(4).lower()], int(m.group(3)))
        if a and b:
            found.append((a, b, m.group(0), m.start(), m.end()))
    for m in RANGE_SAME_MONTH.finditer(text):
        y = int(m.group(4) or year)
        month = MONTHS[m.group(3).lower()]
        a = _valid(y, month, int(m.group(1)))
        b = _valid(y, month, int(m.group(2)))
        if a and b:
            found.append((a, b, m.group(0), m.start(), m.end()))
    for m in RANGE_CN.finditer(text):
        y1 = int(m.group(1) or year)
        y2 = int(m.group(4) or y1)
        a = _valid(y1, int(m.group(2)), int(m.group(3)))
        b = _valid(y2, int(m.group(5)), int(m.group(6)))
        if a and b:
            found.append((a, b, m.group(0), m.start(), m.end()))
    return found


def _classify_range(nearby: str) -> str:
    # Prefer local event/work cues over a distant "deadline" word in a wide window.
    if EVENT_HINTS.search(nearby):
        return "event_range"
    if WORK_HINTS.search(nearby) or (START_HINTS.search(nearby) and END_HINTS.search(nearby)):
        return "work_period"
    if APPLY_HINTS.search(nearby):
        return "apply_deadline"
    return "event_range"


def _point_kind(nearby: str) -> str | None:
    if APPLY_HINTS.search(nearby):
        return "apply_deadline"
    if START_HINTS.search(nearby) and not END_HINTS.search(nearby):
        return "project_start"
    if END_HINTS.search(nearby) and not START_HINTS.search(nearby):
        return "project_end"
    if EVENT_HINTS.search(nearby):
        return "event_point"
    return None


def extract_schedule(text: str, digest_iso: str, published_at: str | None = None) -> list[TimeMark]:
    """Extract point and range temporal marks for timeline display."""
    year = int(digest_iso[:4])
    marks: list[TimeMark] = []
    seen: set[tuple[str, str | None, str | None]] = set()

    def add(mark: TimeMark) -> None:
        key = (mark.kind, mark.start, mark.end)
        if key in seen:
            return
        if mark.shape == "range" and mark.start and mark.end and mark.start > mark.end:
            mark.start, mark.end = mark.end, mark.start
        seen.add(key)
        marks.append(mark)

    # Always include publish / digest date as a point.
    pub = (published_at or digest_iso)[:10]
    add(
        TimeMark(
            kind="published",
            shape="point",
            start=pub,
            confidence="high",
            evidence="digest / published date",
            label="Published",
        )
    )

    deadline = extract_deadline(text, digest_iso)
    if deadline.kind == "rolling":
        add(
            TimeMark(
                kind="rolling",
                shape="open",
                confidence=deadline.confidence,
                evidence=deadline.evidence or "rolling",
                label="Rolling recruitment",
            )
        )
    elif deadline.date:
        add(
            TimeMark(
                kind="apply_deadline",
                shape="point",
                start=deadline.date,
                confidence=deadline.confidence,
                evidence=deadline.evidence,
                label="Apply by",
            )
        )

    for start, end, evidence, s, e in _parse_ranges(text, year):
        nearby = text[max(0, s - 28) : min(len(text), e + 28)]
        kind = _classify_range(nearby)
        if kind == "apply_deadline":
            # Prefer the end of an application window as the deadline point.
            add(
                TimeMark(
                    kind="apply_deadline",
                    shape="point",
                    start=end,
                    confidence="medium",
                    evidence=_evidence(text, s, e),
                    label="Apply by",
                )
            )
            continue
        add(
            TimeMark(
                kind=kind,  # type: ignore[arg-type]
                shape="range",
                start=start,
                end=end,
                confidence="medium",
                evidence=_evidence(text, s, e),
                label="Event" if kind == "event_range" else "Work period",
            )
        )

    # Contextual single dates (start / end / event) — skip ones already used as apply deadline.
    windows = re.finditer(
        r"([^\n。.!?]{0,40}(?:deadline|apply by|held on|will be held|starts?|ends?|from|during|"
        r"截止|報名|舉行|開始|开始|結束|结束|活動)[^\n。.!?]{0,80})",
        text,
        re.I,
    )
    for m in windows:
        chunk = m.group(1)
        value, _ = _parse_in_chunk(chunk, year)
        if not value:
            continue
        kind = _point_kind(chunk)
        if not kind or kind == "apply_deadline":
            continue
        add(
            TimeMark(
                kind=kind,  # type: ignore[arg-type]
                shape="point",
                start=value,
                confidence="medium",
                evidence=chunk.strip()[:160],
                label={
                    "project_start": "Starts",
                    "project_end": "Ends",
                    "event_point": "Event",
                }.get(kind, kind),
            )
        )

    # Optional dateparser pass for start/end/event contexts only.
    try:
        from dateparser.search import search_dates

        settings = {
            "PREFER_DATES_FROM": "future",
            "RELATIVE_BASE": datetime.fromisoformat(digest_iso),
            "RETURN_AS_TIMEZONE_AWARE": False,
        }
        hits = search_dates(text[:5000], languages=["en", "zh"], settings=settings) or []
        digest = date.fromisoformat(digest_iso)
        for fragment, dt in hits:
            if not isinstance(dt, datetime):
                continue
            d = dt.date()
            if d < digest - timedelta(days=1) or d > digest + timedelta(days=400):
                continue
            idx = text.lower().find(fragment.lower())
            if idx < 0:
                continue
            nearby = text[max(0, idx - 50) : idx + len(fragment) + 50]
            kind = _point_kind(nearby)
            if not kind or kind == "apply_deadline":
                continue
            add(
                TimeMark(
                    kind=kind,  # type: ignore[arg-type]
                    shape="point",
                    start=d.isoformat(),
                    confidence="low",
                    evidence=nearby.strip()[:160],
                    label=kind,
                )
            )
    except Exception:
        pass

    # Stable order: chronological by start, open marks last.
    marks.sort(key=lambda m: (m.start or "9999", m.end or "", m.kind))
    return marks
