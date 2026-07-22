from __future__ import annotations

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path

from .models import FacultiesFile, Faculty, Programme

SOURCE = "https://admission.cuhk.edu.hk/programmes/list/"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "faculties.json"

FACULTY_META = [
    ("arts", "Faculty of Arts", "文學院"),
    ("business", "Faculty of Business Administration", "工商管理學院"),
    ("education", "Faculty of Education", "教育學院"),
    ("engineering", "Faculty of Engineering", "工程學院"),
    ("law", "Faculty of Law", "法律學院"),
    ("medicine", "Faculty of Medicine", "醫學院"),
    ("science", "Faculty of Science", "理學院"),
    ("social-science", "Faculty of Social Science", "社會科學院"),
]

SKIP_PREFIXES = (
    "jupas", "non-jupas", "mainland", "international", "admission",
    "filter", "programme / stream", "no result",
)


def _slug(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s[:80] or "programme"


def _is_programme_name(text: str) -> bool:
    t = text.strip()
    if len(t) < 3 or len(t) > 160:
        return False
    low = t.lower()
    if low.startswith("-"):
        return False
    if any(low.startswith(p) for p in SKIP_PREFIXES):
        return False
    if t.isdigit() or t.startswith("#"):
        return False
    if "faculty of" in low:
        return False
    return True


def scrape_html(html: str) -> list[Faculty]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    faculties: list[Faculty] = []

    # Prefer structured headings if present.
    for fid, name_en, name_zh in FACULTY_META:
        heading = None
        for tag in soup.find_all(["h2", "h3", "h4", "button", "summary", "strong"]):
            if name_en.lower() in tag.get_text(" ", strip=True).lower():
                heading = tag
                break
        programmes: list[Programme] = []
        seen: set[str] = set()
        if heading:
            # Collect following sibling links/list items until next faculty heading.
            for sib in heading.find_all_next(["a", "li", "h2", "h3", "h4", "button", "summary"]):
                label = sib.get_text(" ", strip=True)
                if any(name == label or name in label for _, name, _ in FACULTY_META if name != name_en):
                    if "faculty of" in label.lower():
                        break
                if sib.name in {"h2", "h3", "h4", "button", "summary"} and "faculty of" in label.lower() and name_en not in label:
                    break
                if not _is_programme_name(label):
                    continue
                # Prefer anchors that look like programme pages.
                if sib.name == "a" or (sib.name == "li" and sib.find("a")):
                    key = label.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    programmes.append(
                        Programme(id=f"{fid}-{_slug(label)}", nameEn=label, nameZh="", facultyId=fid)
                    )
        faculties.append(Faculty(id=fid, nameEn=name_en, nameZh=name_zh, programmes=programmes))

    # If scrape yielded almost nothing, fall back to curated seed.
    if sum(len(f.programmes) for f in faculties) < 20:
        return curated_faculties()
    return faculties


def curated_faculties() -> list[Faculty]:
    """Official-leaning seed list (2026 Entry) used when HTML structure shifts."""
    raw: dict[str, list[str]] = {
        "arts": [
            "Anthropology", "Bimodal Bilingual Studies", "Chinese Language and Literature",
            "Chinese Studies", "English", "Fine Arts", "History", "Japanese Studies",
            "Linguistics", "Music", "Philosophy", "Public History", "Public Humanities",
            "Religious Studies", "Theology", "Translation",
        ],
        "business": [
            "BBA(IBBA)-JD Double Degree Programme",
            "Biotechnology, Entrepreneurship and Healthcare Management",
            "Global Business Studies", "Global Economics and Finance",
            "Hospitality and Real Estate", "Insurance, Financial and Actuarial Analysis",
            "Integrated Bachelor of Business Administration Programme",
            "Interdisciplinary Data Analytics & X Double Major Programme",
            "Professional Accountancy", "Quantitative Finance",
            "Quantitative Finance and Risk Management Science",
        ],
        "education": [
            "Chinese Language Studies (BA) and Chinese Language Education (BEd)",
            "Early Childhood Education", "Early Childhood Education (BA)",
            "English Studies (BA) and English Language Education (BEd)",
            "Exercise Science and Health Education",
            "Human Movement Science and Health Studies",
            "Learning Design and Technology", "Mathematics and Mathematics Education",
            "Physical Education, Exercise Science and Health",
        ],
        "engineering": [
            "Aerospace Science and Earth Informatics & X Double Major Programme",
            "Artificial Intelligence: Systems and Technologies", "Biomedical Engineering",
            "Computational Data Science", "Computer Engineering", "Computer Science",
            "Computer Science and Engineering", "Electronic Engineering",
            "Energy and Environmental Engineering", "Financial Technology",
            "Information Engineering",
            "Interdisciplinary Data Analytics & X Double Major Programme",
            "Learning Design and Technology", "Materials Science and Engineering",
            "Mathematics and Information Engineering",
            "Mechanical and Automation Engineering",
            "Systems Engineering and Engineering Management",
        ],
        "law": ["BBA(IBBA)-JD Double Degree Programme", "Diplomacy and International Studies", "Laws"],
        "medicine": [
            "Bachelor of Medicine and Bachelor of Surgery (MBChB)",
            "Bachelor of Medicine and Bachelor of Surgery – Global Physician-Leadership Stream (MBChB-GPS)",
            "Biomedical Sciences",
            "Biotechnology, Entrepreneurship and Healthcare Management",
            "Chinese Medicine", "Community Health Practice", "Gerontology",
            "Nursing", "Pharmacy", "Public Health",
        ],
        "science": [
            "Aerospace Science and Earth Informatics & X Double Major Programme",
            "Biotechnology, Entrepreneurship and Healthcare Management",
            "Computational Data Science", "Earth and Environmental Sciences",
            "Enrichment Mathematics", "Enrichment Stream in Theoretical Physics",
            "Interdisciplinary Data Analytics & X Double Major Programme",
            "Learning Design and Technology", "Materials Science and Engineering",
            "Mathematics and Information Engineering", "Natural Sciences",
            "Quantitative Finance and Risk Management Science", "Risk Management Science",
            "Science",
        ],
        "social-science": [
            "Aerospace Science and Earth Informatics & X Double Major Programme",
            "Architectural Studies", "Data Science and Policy Studies",
            "Diplomacy and International Studies", "Economics",
            "Economics (CUHK-Tsinghua University Dual Undergraduate Degree Programme)",
            "Gender Studies", "Geography and Resource Management", "Global Communication",
            "Global Economics and Finance", "Global Studies",
            "Government and Public Administration", "Journalism and Communication",
            "Psychology", "Social Science (Broad-based)", "Social Work",
            "Society and Sustainable Development", "Sociology", "Urban Studies",
        ],
    }
    zh = {fid: name_zh for fid, _, name_zh in FACULTY_META}
    en = {fid: name_en for fid, name_en, _ in FACULTY_META}
    out: list[Faculty] = []
    for fid, programmes in raw.items():
        out.append(
            Faculty(
                id=fid,
                nameEn=en[fid],
                nameZh=zh[fid],
                programmes=[
                    Programme(id=f"{fid}-{_slug(p)}", nameEn=p, nameZh="", facultyId=fid)
                    for p in programmes
                ],
            )
        )
    return out


def run(use_network: bool = True) -> Path:
    faculties: list[Faculty]
    if use_network:
        try:
            import requests

            resp = requests.get(SOURCE, timeout=30, headers={"User-Agent": "CUHK-MailRoute/2.0"})
            resp.raise_for_status()
            faculties = scrape_html(resp.text)
        except Exception as exc:
            print(f"Network scrape failed ({exc}); using curated list.")
            faculties = curated_faculties()
    else:
        faculties = curated_faculties()

    payload = FacultiesFile(
        sourceUrl=SOURCE,
        fetchedAt=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        faculties=faculties,
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(payload.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {sum(len(f.programmes) for f in faculties)} programmes → {OUT}")
    return OUT


def cli() -> int:
    parser = argparse.ArgumentParser(description="Scrape CUHK faculty/programme list")
    parser.add_argument("--offline", action="store_true", help="Use curated seed only")
    args = parser.parse_args()
    run(use_network=not args.offline)
    return 0


if __name__ == "__main__":
    raise SystemExit(cli())
