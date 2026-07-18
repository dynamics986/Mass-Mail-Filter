from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from pipeline.enrich import enrich_item

GOLDEN = Path(__file__).with_name("golden.json")


def main() -> int:
    cases = json.loads(GOLDEN.read_text(encoding="utf-8"))
    ok = 0
    fails: list[str] = []
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
        bad = []
        if exp.get("deadline") and item.deadline != exp["deadline"]:
            bad.append(f"deadline {item.deadline!r}!={exp['deadline']!r}")
        if exp.get("deadlineKind") and item.deadlineKind != exp["deadlineKind"]:
            bad.append(f"kind {item.deadlineKind!r}")
        if exp.get("type") and item.taxonomy.type != exp["type"]:
            bad.append(f"type {item.taxonomy.type!r}")
        if exp.get("hasCompensation") and item.compensation is None:
            bad.append("missing compensation")
        if not item.summary:
            bad.append("empty summary")
        if bad:
            fails.append(f"{case['id']}: {', '.join(bad)}")
        else:
            ok += 1
    print(f"golden: {ok}/{len(cases)} passed")
    for line in fails:
        print(" FAIL", line)

    feed = Path(__file__).resolve().parents[2] / "public" / "data" / "feed.json"
    if feed.exists():
        items = json.loads(feed.read_text(encoding="utf-8"))
        n = len(items)
        print(
            "feed:",
            n,
            "items | deadline",
            f"{100 * sum(1 for i in items if i.get('deadline')) / n:.1f}%",
            "| summary",
            f"{100 * sum(1 for i in items if i.get('summary')) / n:.1f}%",
            "| types",
            dict(Counter(i.get("taxonomy", {}).get("type") for i in items)),
        )
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
