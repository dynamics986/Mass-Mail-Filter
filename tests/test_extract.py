from __future__ import annotations

from pipeline.clean import clean_body
from pipeline.enrich import enrich_item
from pipeline.extract_deadline import extract_deadline
from pipeline.extract_taxonomy import extract_taxonomy
from pipeline.extract_fields import extract_compensation
from pipeline.extract_summary import is_redundant_summary


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


def test_service_prices_are_not_compensation_or_paid_work():
    title = "中醫調治睡眠健康計劃 | Chinese Medicine Treatment Program for Sleep Health"
    body = """
    於首兩個月內可以優惠價接受下列中醫服務。
    中醫診症連三劑內服中藥 $360起；診症連針灸 $290起。
    助眠香包供市民選購，每個只需港幣33元。
    Consultation service charge. Each sachet is priced at HKD 33 for purchase.
    The 3 doses of herbs are for internal intake only.
    """
    assert extract_compensation(body) is None
    taxonomy = extract_taxonomy(title, body)
    assert taxonomy.type == "admin"
    assert "intern" not in taxonomy.roles


def test_redundant_summary_detects_truncated_title_section():
    title = "(Earn $700!!!) Recruiting adults aged 18–65 who have recovered from depression to participate in a study on depression recurrence (participants on medication are welcome if condition is medically stable) (獲得 $700!!!) 誠邀抑鬱症康復者參與研究"
    copied = ") Recruiting adults aged 18–65 who have recovered from depression to participate in a study on depression recurrence (participants on medication are welcome if condition is medically stable) (獲得 $700!!!"
    assert is_redundant_summary(title, copied)


def test_redundant_summary_keeps_new_team_introduction():
    title = "招募聽力損失長者及其孫子女參與互動實驗"
    summary = "我們是香港中文大學大腦與認知研究所（BMI）的研究團隊。我們團隊誠摯邀請有聽力損失的長者及其孫子女來參與一項互動研究。"
    assert not is_redundant_summary(title, summary)


def test_redundant_summary_preserves_chinese_sentence_boundary():
    title = "讲座报名"
    summary = "欢迎同学参加就业讲座。报名截止日期：2026年8月5日。名额有限。"
    assert not is_redundant_summary(title, summary)
