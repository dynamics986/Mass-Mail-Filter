from datetime import date

from pipeline.cuhk import DIGEST_LOOKBACK_DAYS, candidate_dates


def test_default_candidates_cover_the_recent_four_weeks() -> None:
    dates = candidate_dates(start=date(2026, 7, 19))

    assert DIGEST_LOOKBACK_DAYS == 28
    assert len(dates) == 28
    assert dates[0] == "20260719"
    assert dates[-1] == "20260622"
