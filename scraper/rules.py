from __future__ import annotations

import re
from datetime import date, datetime
from .models import Compensation, Requirement

TAG_RULES = {
    "Engineering": ["engineering", "工程"], "AI": ["artificial intelligence", " ai ", "人工智能"],
    "Web": ["web development", "website", "frontend", "backend", "网页", "網頁"],
    "Data": ["data analysis", "data science", "数据分析", "數據分析"],
    "Student helper": ["student helper", "學生助理", "学生助理"],
    "Research": ["research", "study", "experiment", "研究", "實驗", "实验"],
    "Language": ["language", "cantonese", "mandarin", "putonghua", "語言", "粤语", "粵語", "普通话", "普通話"],
}
MONTHS = {name.lower(): i for i, name in enumerate(["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]) if name}

def extract_tags(text: str) -> list[str]:
    lower = f" {text.lower()} "
    return [tag for tag, words in TAG_RULES.items() if any(word in lower for word in words)]

def extract_compensation(text: str) -> Compensation | None:
    lower = text.lower()
    if not any(word in lower for word in ["hk$", "hkd", "$", "cash", "coupon", "voucher", "allowance", "stipend", "reward", "酬", "津貼", "津贴", "現金", "现金", "禮券", "礼券"]):
        return None
    values = [int(x.replace(",", "")) for x in re.findall(r"(?:hk\s*\$|hkd\s*\$?|\$)\s*([0-9][0-9,]*)", lower, re.I)]
    ctype = "voucher" if any(x in lower for x in ["voucher", "coupon", "禮券", "礼券"]) else "allowance" if any(x in lower for x in ["allowance", "stipend", "津貼", "津贴"]) else "prize" if any(x in lower for x in ["prize", "draw", "抽獎", "抽奖"]) else "cash"
    if not values:
        return Compensation(type=ctype)
    unique = sorted(set(values))
    is_max = any(x in lower for x in ["up to", "maximum", "max.", "最高", "最多"])
    return Compensation(type=ctype, minHkd=None if is_max else unique[0], maxHkd=unique[-1])

def _valid_iso(year: int, month: int, day: int) -> str | None:
    try: return date(year, month, day).isoformat()
    except ValueError: return None

def extract_deadline(text: str, digest_date: str) -> str | None:
    year = int(digest_date[:4])
    contexts = re.findall(r"(?:deadline|closing date|apply by|截止日期|截止|截至)[^\n。]{0,80}", text, re.I)
    for chunk in contexts:
        iso = re.search(r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})", chunk)
        if iso and (value := _valid_iso(*map(int, iso.groups()))): return value
        dmy = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s*(20\d{2})?", chunk)
        if dmy and dmy.group(2).lower() in MONTHS:
            value = _valid_iso(int(dmy.group(3) or year), MONTHS[dmy.group(2).lower()], int(dmy.group(1)))
            if value: return value
        chinese = re.search(r"(?:(20\d{2})\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]", chunk)
        if chinese and (value := _valid_iso(int(chinese.group(1) or year), int(chinese.group(2)), int(chinese.group(3)))): return value
    return None

def extract_requirements(text: str) -> list[Requirement]:
    reqs: list[Requirement] = []
    patterns = [
        ("nativeLanguage", "Cantonese", [r"native\s+cantonese(?:[- ]speakers?)?", r"cantonese\s+native\s+speakers?", r"[母本]語[為是]?粵語", r"粤语母语", r"粵語母語"]),
        ("nativeLanguage", "Mandarin", [r"native\s+(?:mandarin|putonghua)(?:[- ]speakers?)?", r"mandarin\s+native\s+speakers?", r"普通[话話]母[语語]", r"母[语語][為是]?普通[话話]"]),
        ("spokenLanguage", "Cantonese", [r"cantonese[- ]speaking", r"speak\s+cantonese", r"能操粵語", r"会说粤语", r"會說粵語"]),
        ("spokenLanguage", "Mandarin", [r"mandarin[- ]speaking", r"speak\s+mandarin", r"能操普通[话話]"]),
        ("studentLevel", "undergraduate", [r"undergraduate students?", r"本科生"]),
        ("studentLevel", "postgraduate", [r"postgraduate students?", r"研究生"]),
        ("gender", "male", [r"\bmale\b", r"男性", r"男士"]),
        ("gender", "female", [r"\bfemale\b", r"women\b", r"女性", r"女士"]),
        ("residency", "Mainland Chinese", [r"mainland chinese", r"chinese mainland students?", r"中国大陆学生", r"中國大陸學生"]),
    ]
    for field, value, variants in patterns:
        for pattern in variants:
            match = re.search(pattern, text, re.I)
            if match:
                reqs.append(Requirement(field=field, operator="equals", value=value, confidence="high", evidence=_evidence(text, match.start(), match.end())))
                break
    age_range = re.search(r"aged?\s*(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})|年齡介乎\s*(\d{1,2})\s*(?:至|到)\s*(\d{1,2})", text, re.I)
    if age_range:
        values = [int(x) for x in age_range.groups() if x]
        ev = _evidence(text, age_range.start(), age_range.end())
        reqs.extend([Requirement(field="age", operator="min", value=min(values), confidence="high", evidence=ev), Requirement(field="age", operator="max", value=max(values), confidence="high", evidence=ev)])
    return _dedupe_requirements(reqs)

def _evidence(text: str, start: int, end: int) -> str:
    return re.sub(r"\s+", " ", text[max(0, start - 40):min(len(text), end + 60)]).strip()

def _dedupe_requirements(reqs: list[Requirement]) -> list[Requirement]:
    seen: set[tuple[str, str, str]] = set(); result = []
    for req in reqs:
        key = (req.field, req.operator, str(req.value).lower())
        if key not in seen: seen.add(key); result.append(req)
    return result
