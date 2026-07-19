from __future__ import annotations

import re

from .models import Compensation, Requirement

PAID_WORDS = [
    "hk$", "hkd", "$", "cash", "coupon", "voucher", "allowance", "stipend",
    "reward", "酬", "津貼", "津贴", "現金", "现金", "禮券", "礼券", "hourly rate",
]

EXPENSE_PATTERNS = [
    r"service\s+charge", r"consultation", r"priced\s+at", r"for\s+purchase",
    r"收費", r"收费", r"優惠價", r"优惠价", r"選購", r"选购", r"每個只需", r"每个只需",
    r"原價", r"原价", r"額外.{0,12}收費", r"额外.{0,12}收费", r"診症", r"诊症",
]
BENEFIT_PATTERNS = [
    r"compensation", r"reward", r"honorarium", r"salary", r"wages?", r"hourly\s+rate",
    r"cash\s+incentive", r"stipend", r"allowance", r"報酬", r"报酬", r"可獲", r"可获",
    r"酬謝", r"酬谢", r"津貼", r"津贴", r"薪金", r"工資", r"工资",
]


def extract_compensation(text: str) -> Compensation | None:
    lower = text.lower()
    if not any(w in lower for w in PAID_WORDS):
        return None
    # Prices paid by the reader are not compensation received by the reader.
    has_expense_context = any(re.search(pattern, lower, re.I) for pattern in EXPENSE_PATTERNS)
    has_benefit_context = any(re.search(pattern, lower, re.I) for pattern in BENEFIT_PATTERNS)
    if has_expense_context and not has_benefit_context:
        return None
    values = [int(x.replace(",", "")) for x in re.findall(r"(?:hk\s*\$|hkd\s*\$?|\$)\s*([0-9][0-9,]*)", lower, re.I)]
    if any(x in lower for x in ["voucher", "coupon", "禮券", "礼券"]):
        kind = "voucher"
    elif any(x in lower for x in ["allowance", "stipend", "津貼", "津贴"]):
        kind = "allowance"
    elif any(x in lower for x in ["prize", "draw", "抽獎", "抽奖"]):
        kind = "prize"
    else:
        kind = "cash"
    if not values:
        return Compensation(type=kind)  # type: ignore[arg-type]
    unique = sorted(set(values))
    is_max = any(x in lower for x in ["up to", "maximum", "max.", "最高", "最多"])
    return Compensation(type=kind, minHkd=None if is_max else unique[0], maxHkd=unique[-1])  # type: ignore[arg-type]


def _evidence(text: str, start: int, end: int) -> str:
    return re.sub(r"\s+", " ", text[max(0, start - 40) : min(len(text), end + 60)]).strip()


def extract_requirements(text: str) -> list[Requirement]:
    """Extract eligibility — intentionally ignores Mass Mail chrome phrases."""
    # Work on cleaned body; still guard against digest chrome.
    if "Digest of CUHK Mass Mails for Undergraduate Students" in text and len(text) < 400:
        return []

    reqs: list[Requirement] = []
    patterns: list[tuple[str, str, list[str]]] = [
        ("nativeLanguage", "Cantonese", [r"native\s+cantonese(?:[- ]speakers?)?", r"cantonese\s+native\s+speakers?", r"[母本]語[為是]?粵語", r"粤语母语", r"粵語母語", r"廣東話母語", r"广东话母语"]),
        ("nativeLanguage", "Mandarin", [r"native\s+(?:mandarin|putonghua)(?:[- ]speakers?)?", r"普通[话話]母[语語]", r"母[语語][為是]?普通[话話]"]),
        ("nativeLanguage", "English", [r"native\s+english(?:[- ]speakers?)?", r"english is your first/native", r"looking for native english"]),
        ("spokenLanguage", "Cantonese", [r"cantonese[- ]speaking", r"fluent in cantonese", r"廣東話流利", r"能操粵語", r"会说粤语"]),
        ("spokenLanguage", "Mandarin", [r"mandarin[- ]speaking", r"speak\s+mandarin", r"能操普通[话話]"]),
        ("spokenLanguage", "English", [r"fluent in english", r"english[- ]speaking"]),
        ("studentLevel", "undergraduate", [r"\bundergraduate students?\b(?!\s+digest)", r"(?<!mails for )本科生"]),
        ("studentLevel", "postgraduate", [r"\bpostgraduate students?\b", r"研究生"]),
        ("gender", "male", [r"\bmale\b", r"男性", r"男士"]),
        ("gender", "female", [r"\bfemale\b", r"\bwomen\b", r"女性", r"女士"]),
        ("residency", "Mainland Chinese", [r"mainland chinese", r"chinese mainland students?", r"中国大陆学生", r"中國大陸學生"]),
    ]
    for field, value, variants in patterns:
        for pattern in variants:
            match = re.search(pattern, text, re.I)
            if not match:
                continue
            # Reject chrome false positive for undergraduate.
            ev = _evidence(text, match.start(), match.end())
            if field == "studentLevel" and "mass mails for undergraduate" in ev.lower():
                continue
            reqs.append(
                Requirement(field=field, operator="equals", value=value, confidence="high", evidence=ev)  # type: ignore[arg-type]
            )
            break

    age_range = re.search(
        r"aged?\s*(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})|年齡介乎\s*(\d{1,2})\s*(?:至|到)\s*(\d{1,2})|年滿(\d{1,2})歲",
        text,
        re.I,
    )
    if age_range:
        groups = [int(x) for x in age_range.groups() if x]
        ev = _evidence(text, age_range.start(), age_range.end())
        if len(groups) == 1:
            reqs.append(Requirement(field="age", operator="min", value=groups[0], confidence="high", evidence=ev))
        elif len(groups) >= 2:
            reqs.append(Requirement(field="age", operator="min", value=min(groups), confidence="high", evidence=ev))
            reqs.append(Requirement(field="age", operator="max", value=max(groups), confidence="high", evidence=ev))

    seen: set[tuple[str, str, str]] = set()
    out: list[Requirement] = []
    for req in reqs:
        key = (req.field, req.operator, str(req.value).lower())
        if key not in seen:
            seen.add(key)
            out.append(req)
    return out
