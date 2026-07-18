from __future__ import annotations

from pipeline.clean import clean_body
from pipeline.enrich import enrich_item
from pipeline.extract_deadline import extract_deadline
from pipeline.extract_taxonomy import extract_taxonomy


SAMPLE_HELPER = """
Mass Mail System
Digest of CUHK Mass Mails for Undergraduate Students
» 2026/07/17 » Announcements
From: Centre for Learning Enhancement And Research
--------------------------------------------------------------------------------
Student Helpers Recruitment
The Centre is recruiting student helpers to provide logistical support.
Hourly Rate: HK$64
Eligibility: All CUHK students eligible for registering as a student helper.
Apply: please complete the form. Application deadline: 2026-08-10.
"""


def test_clean_strips_chrome():
    cleaned = clean_body(SAMPLE_HELPER)
    assert "Digest of CUHK Mass Mails" not in cleaned
    assert "Student Helpers Recruitment" in cleaned
    assert "HK$64" in cleaned


def test_deadline_from_apply_window():
    info = extract_deadline(SAMPLE_HELPER, "2026-07-17")
    assert info.date == "2026-08-10"
    assert info.kind == "apply"
    assert info.confidence in {"high", "medium"}


def test_taxonomy_paid_helper():
    tax = extract_taxonomy("Student Helpers Recruitment (HK$64/hr)", SAMPLE_HELPER)
    assert tax.type == "paid_work"
    assert "helper" in tax.roles


def test_enrich_no_undergrad_chrome_false_positive():
    item = enrich_item(
        id="demo-1",
        digest_date="20260717",
        category="Announcements",
        title="Student Helpers Recruitment (HK$64/hr)",
        body_text=SAMPLE_HELPER,
        source_url="http://example.com/demo-1",
    )
    assert item.summary
    assert item.compensation is not None
    assert not any(
        r.field == "studentLevel" and "mass mails for undergraduate" in r.evidence.lower()
        for r in item.requirements
    )


def test_rolling_deadline():
    text = "Applications are accepted on a rolling basis until positions are filled."
    info = extract_deadline(text, "2026-07-17")
    assert info.kind == "rolling"
