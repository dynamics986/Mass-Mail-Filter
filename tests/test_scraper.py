from datetime import date
from pathlib import Path
from scraper.cuhk import ListEntry, parse_detail, parse_list
from scraper.main import retain
from scraper.models import MailItem
from scraper.rules import extract_compensation, extract_deadline, extract_requirements

FIXTURES = Path(__file__).parent / "fixtures"
def test_valid_and_empty_digest():
    entries = parse_list((FIXTURES / "digest.html").read_text(), "20260710")
    assert [x.id for x in entries] == ["101001", "101002"]
    assert entries[0].category == "Announcements"
    assert parse_list("<p>---------- No Digest Found ----------</p>", "20260710") == []

def test_detail_is_plain_and_structured():
    entry = ListEntry("101001", "20260710", "Announcements", "Student Helper", "https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260710/101001", 1)
    item = parse_detail(entry, (FIXTURES / "detail.html").read_text(), "2026-07-10T05:00:00Z")
    assert item and "alert" not in item.bodyText
    assert item.digestDate == "2026-07-10"
    assert item.deadline == "2026-07-31"
    assert item.compensation and item.compensation.maxHkd == 500
    assert any(r.field == "nativeLanguage" and r.value == "Mandarin" for r in item.requirements)

def test_rules_distinguish_native_from_spoken():
    native = extract_requirements("Recruiting native Cantonese speakers")
    spoken = extract_requirements("Recruiting Cantonese-speaking student helpers")
    assert native[0].field == "nativeLanguage"
    assert spoken[0].field == "spokenLanguage"
    assert extract_compensation("Maximum HK$1,100 voucher").maxHkd == 1100
    assert extract_deadline("截止日期：2026年7月31日", "20260710") == "2026-07-31"

def test_retention_keeps_four_issues_and_old_active():
    def item(id, digest, deadline=None):
        return MailItem(id=id, digestDate=digest, category="A", title=id, bodyText="body", sourceUrl="https://example.com", deadline=deadline, publishedAt="2026-01-01T00:00:00+08:00", fetchedAt="2026-01-01T00:00:00Z")
    items = [item("1", "20260710"), item("2", "20260703"), item("3", "20260626"), item("4", "20260619"), item("5", "20260612"), item("6", "20260605", "2026-08-01")]
    assert {x.id for x in retain(items, date(2026, 7, 16))} == {"1", "2", "3", "4", "6"}
