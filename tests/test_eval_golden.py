from __future__ import annotations

import json
from pathlib import Path

from pipeline.enrich import enrich_item

GOLDEN = Path(__file__).resolve().parents[1] / "pipeline" / "eval" / "golden.json"


def test_golden_set():
    cases = json.loads(GOLDEN.read_text(encoding="utf-8"))
    assert len(cases) >= 5
    for case in cases:
        item = enrich_item(
            id=case["id"],
            digest_date=case["digestDate"],
            category="Announcements",
            title=case["title"],
            body_text=case["body"],
            source_url=f"http://example.com/{case['id']}",
        )
        exp = case["expect"]
        if "deadline" in exp:
            assert item.deadline == exp["deadline"], case["id"]
        if "deadlineKind" in exp:
            assert item.deadlineKind == exp["deadlineKind"], case["id"]
        if "type" in exp:
            assert item.taxonomy.type == exp["type"], (case["id"], item.taxonomy.type)
        if exp.get("hasCompensation"):
            assert item.compensation is not None, case["id"]
        if "nativeLanguage" in exp:
            assert any(
                r.field == "nativeLanguage" and r.value == exp["nativeLanguage"] for r in item.requirements
            ), case["id"]
        assert item.summary, case["id"]
