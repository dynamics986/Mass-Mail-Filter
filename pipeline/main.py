from __future__ import annotations

import argparse
import json
import time
from datetime import UTC, date, datetime
from pathlib import Path

from pydantic import TypeAdapter

from .cuhk import DIGEST_LOOKBACK_DAYS, LIST_URL, candidate_dates, collect_digest, create_session
from .enrich import reenrich_raw_dict
from .models import FeedMeta, MailItem

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "public" / "data" / "feed.json"
META = ROOT / "public" / "data" / "meta.json"


def retain(items: list[MailItem], today: date | None = None) -> list[MailItem]:
    today = today or datetime.now(UTC).date()
    latest_four = sorted({item.digestDate for item in items}, reverse=True)[:4]
    kept = [
        item
        for item in items
        if item.digestDate in latest_four
        or (item.deadline and date.fromisoformat(item.deadline) >= today)
    ]
    return sorted(kept, key=lambda item: (item.digestDate, item.id), reverse=True)


def load_existing() -> list[MailItem]:
    if not FEED.exists():
        return []
    raw = json.loads(FEED.read_text(encoding="utf-8"))
    adapter = TypeAdapter(list[MailItem])
    try:
        return [item for item in adapter.validate_python(raw) if not item.id.startswith("sample-")]
    except Exception:
        # Legacy feed without taxonomy/summary — re-enrich on load.
        return [reenrich_raw_dict(item) for item in raw if not str(item.get("id", "")).startswith("sample-")]


def write_feed(items: list[MailItem]) -> None:
    FEED.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    latest = max(item.digestDate for item in items)
    source = LIST_URL.format(date=latest.replace("-", ""))
    FEED.write_text(
        json.dumps(
            [json.loads(item.model_dump_json(exclude_none=True)) for item in items],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    meta = FeedMeta(latestDigest=latest, fetchedAt=now, itemCount=len(items), status="ok", sourceUrl=source)  # type: ignore[arg-type]
    META.write_text(meta.model_dump_json(indent=2) + "\n", encoding="utf-8")


def run(dates: list[str]) -> int:
    existing = load_existing()
    known = {item.id for item in existing}
    found: list[MailItem] = []
    session = create_session()
    for digest_date in dates:
        try:
            fresh = collect_digest(session, digest_date, skip_ids=known)
        except Exception as exc:
            print(f"Skipping {digest_date}: {exc}")
            continue
        found.extend(fresh)
        known.update(item.id for item in fresh)
        time.sleep(0.25)
    if not found:
        print("No new digest items; existing files left unchanged.")
        has_real_data = any(not item.id.startswith("sample-") for item in existing)
        return 0 if has_real_data else 1
    real_existing = [item for item in existing if not item.id.startswith("sample-")]
    merged = retain(real_existing + found)
    if not merged:
        raise RuntimeError("Refusing to publish an empty feed")
    write_feed(merged)
    print(f"Added {len(found)} items; published {len(merged)} items.")
    return 0


def migrate_legacy(path: Path) -> int:
    raw = json.loads(path.read_text(encoding="utf-8"))
    items = [reenrich_raw_dict(item) for item in raw]
    write_feed(retain(items))
    print(f"Migrated {len(items)} items → {FEED}")
    return 0


def cli() -> int:
    parser = argparse.ArgumentParser(description="CUHK MailRoute digest pipeline")
    parser.add_argument("--date", action="append", help="Digest date YYYYMMDD")
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=DIGEST_LOOKBACK_DAYS,
        help="Calendar days to probe when no explicit date is supplied (default: recent four weeks)",
    )
    parser.add_argument("--migrate", type=Path, help="Re-enrich a legacy feed.json")
    args = parser.parse_args()
    if args.migrate:
        return migrate_legacy(args.migrate)
    return run(args.date or candidate_dates(days=max(1, args.lookback_days)))


if __name__ == "__main__":
    raise SystemExit(cli())
