from pipeline.extract_schedule import extract_schedule


def test_extracts_publish_deadline_and_event_range():
    text = """
    Student Helpers Recruitment. Hourly Rate: HK$64.
    Application deadline: 2026-08-10.
    Events will be held during 26-28 August 2026 at CUHK.
    """
    marks = extract_schedule(text, "2026-07-17", published_at="2026-07-17T00:00:00+08:00")
    kinds = {m.kind for m in marks}
    assert "published" in kinds
    assert "apply_deadline" in kinds
    assert any(m.kind == "event_range" and m.start == "2026-08-26" and m.end == "2026-08-28" for m in marks)


def test_rolling_and_work_period():
    text = """
    Research Assistant. Applications on a rolling basis until positions are filled.
    Employment period: 2026-09-01 to 2026-12-15.
    """
    marks = extract_schedule(text, "2026-07-17")
    assert any(m.kind == "rolling" for m in marks)
    assert any(m.kind == "work_period" and m.start == "2026-09-01" and m.end == "2026-12-15" for m in marks)
