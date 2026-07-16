from __future__ import annotations

import argparse
import json
from datetime import UTC, date, datetime
from pathlib import Path
from pydantic import TypeAdapter
from .cuhk import LIST_URL, candidate_dates, collect_digest, create_session
from .models import FeedMeta, MailItem

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "public" / "data" / "feed.json"
META = ROOT / "public" / "data" / "meta.json"

def retain(items: list[MailItem], today: date | None = None) -> list[MailItem]:
    today = today or datetime.now(UTC).date()
    latest_four = sorted({item.digestDate for item in items}, reverse=True)[:4]
    kept = [item for item in items if item.digestDate in latest_four or (item.deadline and date.fromisoformat(item.deadline) >= today)]
    return sorted(kept, key=lambda item: (item.digestDate, item.id), reverse=True)

def load_existing() -> list[MailItem]:
    if not FEED.exists(): return []
    return TypeAdapter(list[MailItem]).validate_python(json.loads(FEED.read_text(encoding="utf-8")))

def write_feed(items: list[MailItem]) -> None:
    FEED.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    latest = max(item.digestDate for item in items)
    source = LIST_URL.format(date=latest.replace("-", ""))
    FEED.write_text(json.dumps([json.loads(item.model_dump_json()) for item in items], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta = FeedMeta(latestDigest=latest, fetchedAt=now, itemCount=len(items), status="ok", sourceUrl=source)
    META.write_text(meta.model_dump_json(indent=2) + "\n", encoding="utf-8")

def run(dates: list[str]) -> int:
    existing = load_existing(); known = {item.id for item in existing}; found: list[MailItem] = []
    session = create_session()
    for digest_date in dates:
        try: fresh = collect_digest(session, digest_date)
        except Exception as exc:
            print(f"Skipping {digest_date}: {exc}"); continue
        found.extend(item for item in fresh if item.id not in known)
    if not found:
        print("No new digest items; existing files left unchanged.")
        return 0 if existing else 1
    merged = retain(existing + found)
    if not merged: raise RuntimeError("Refusing to publish an empty feed")
    write_feed(merged); print(f"Added {len(found)} items; published {len(merged)} items.")
    return 0

def cli() -> int:
    parser = argparse.ArgumentParser(description="Fetch public CUHK UG Mass Mail digest data")
    parser.add_argument("--date", action="append", help="Digest date in YYYYMMDD; may be repeated")
    args = parser.parse_args()
    return run(args.date or candidate_dates())

if __name__ == "__main__": raise SystemExit(cli())
