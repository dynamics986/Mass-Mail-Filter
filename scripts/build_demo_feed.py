#!/usr/bin/env python3
"""Build a small demo feed without optional NLP wheels (stdlib + pipeline fallbacks)."""
from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline.enrich import enrich_item  # noqa: E402
from pipeline.main import retain, write_feed  # noqa: E402

DEMOS = [
    {
        "id": "sample-helper",
        "title": "Student Helpers Recruitment (HK$64/hr) - On-site event support",
        "body": """Student Helpers Recruitment
The Centre for Learning Enhancement And Research is recruiting student helpers.
Hourly Rate: HK$64
Duties: reception, stage and technical support.
Eligibility: CUHK students under SHES.
Application deadline: 2026-08-20.
Apply: https://example.com/apply-helper
""",
    },
    {
        "id": "sample-ra",
        "title": "Research Assistant (Part-time) — NLP project, HK$8,000/month",
        "body": """Research Assistant wanted for an NLP project in the Faculty of Engineering.
Monthly allowance HK$8000. Prefer Computer Science or AI background.
Applications reviewed on a rolling basis until the position is filled.
""",
    },
    {
        "id": "sample-english",
        "title": "[Online experiment] Looking for native English speakers — HK$250",
        "body": """Looking for participants for a language production study.
English is your first/native and dominant language.
You will get HK$250 in cash upon completion of the task.
""",
    },
    {
        "id": "sample-talk",
        "title": "Career talk: Internships in Hong Kong finance",
        "body": """Welcome to join our career seminar on internship opportunities.
報名截止日期：2026年8月5日。
Hosted by the Faculty of Business Administration.
""",
    },
    {
        "id": "sample-competition",
        "title": "CUHK Hackathon 2026 — Call for teams",
        "body": """Join the CUHK Hackathon competition. Build software prototypes in 48 hours.
Prizes up to HK$10000. Register by 15 September 2026.
""",
    },
    {
        "id": "sample-volunteer",
        "title": "Community volunteer programme — campus sustainability",
        "body": """Volunteer for a campus sustainability service programme.
No stipend. Certificate of participation available upon completion.
""",
    },
    {
        "id": "sample-admin",
        "title": "ITSC system maintenance reminder",
        "body": """Please note the office hours and system maintenance window this weekend.
This is an administrative notice only.
""",
    },
]


def main() -> int:
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    items = [
        enrich_item(
            id=d["id"],
            digest_date="2026-07-17",
            category="Announcements",
            title=d["title"],
            body_text=d["body"],
            source_url=f"http://example.com/{d['id']}",
            fetched_at=now,
        )
        for d in DEMOS
    ]
    # Optionally merge a slice of a legacy feed if provided.
    if len(sys.argv) > 1:
        legacy = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        from pipeline.enrich import reenrich_raw_dict

        extras = [reenrich_raw_dict(x) for x in legacy[:40]]
        items = retain(items + extras)
    write_feed(items)
    print(f"Wrote {len(items)} demo/migrated items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
