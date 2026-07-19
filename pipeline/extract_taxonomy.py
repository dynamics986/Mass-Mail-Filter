from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import re
from typing import Any

import yaml

from .models import L1Type, L2Domain, L3Role, Taxonomy

RULES_PATH = Path(__file__).parent / "taxonomy" / "rules.yaml"


@lru_cache(maxsize=1)
def load_rules() -> dict[str, Any]:
    return yaml.safe_load(RULES_PATH.read_text(encoding="utf-8"))


def _hits(text: str, words: list[str]) -> list[str]:
    lower = text.lower()
    found = []
    for w in words:
        token = w.lower()
        matched = (
            bool(re.search(rf"(?<!\w){re.escape(token)}(?!\w)", lower))
            if re.search(r"[a-z0-9]", token)
            else token in lower
        )
        if token and matched:
            found.append(w)
    return found


def extract_taxonomy(title: str, body: str) -> Taxonomy:
    rules = load_rules()
    text = f"{title}\n{body}"
    lower = text.lower()

    best_type: L1Type = "admin"
    best_score = -1
    evidence_bits: list[str] = []

    for name, cfg in rules["l1"].items():
        words = cfg.get("any") or []
        matched = _hits(text, words)
        score = len(matched) * int(cfg.get("weight", 1))
        # Subject recruitment / RA titles lean research over generic paid_work.
        if name == "paid_work" and any(
            x in lower
            for x in [
                "looking for participants",
                "招募參與",
                "online experiment",
                "research assistant",
                "研究助理",
            ]
        ):
            score = max(0, score - 3)
        expense_notice = any(
            re.search(pattern, lower, re.I)
            for pattern in [r"service\s+charge", r"consultation", r"priced\s+at", r"for\s+purchase", r"收費", r"優惠價", r"選購", r"診症"]
        )
        employment_signal = any(
            re.search(pattern, lower, re.I)
            for pattern in [r"\brecruit", r"\bjob\b", r"\bemployment\b", r"student\s+helper", r"research\s+assistant", r"hourly\s+rate", r"薪金", r"工資", r"招募"]
        )
        if name == "paid_work" and expense_notice and not employment_signal:
            score = 0
        if name == "research" and any(x in lower for x in ["research assistant", "研究助理"]):
            score += 4
        if score > best_score:
            best_score = score
            best_type = name  # type: ignore[assignment]
            evidence_bits = matched[:3]

    if best_score <= 0:
        best_type = "admin"
        evidence_bits = []

    domains: list[L2Domain] = []
    for domain, words in rules["l2"].items():
        # Avoid Web false positive from Chinese 網頁 browse wording.
        filtered = [w for w in words if w not in {"网页", "網頁"}]
        if _hits(text, filtered):
            domains.append(domain)  # type: ignore[arg-type]
    if not domains:
        domains = ["Cross"]

    roles: list[L3Role] = []
    for role, words in rules["l3"].items():
        if _hits(text, words):
            roles.append(role)  # type: ignore[arg-type]
    if not roles:
        roles = ["applicant"] if best_type in {"paid_work", "research", "programme", "competition"} else ["attendee"]

    conf = "high" if best_score >= 3 else "medium" if best_score >= 1 else "low"
    return Taxonomy(
        type=best_type,
        domains=domains[:4],
        roles=roles[:3],
        confidence=conf,
        evidence=", ".join(evidence_bits)[:160],
    )


def is_subject_recruitment(title: str, body: str) -> bool:
    rules = load_rules()
    return bool(_hits(f"{title}\n{body}", rules.get("subject_recruitment") or []))
