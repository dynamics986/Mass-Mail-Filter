from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .enrich import enrich_item
from .models import MailItem

BASE = "http://cumassmail.itsc.cuhk.edu.hk"
LIST_URL = BASE + "/weekly/Digest/List/UG/{date}/Announcements"
MESSAGE_RE = re.compile(r"/weekly/Digest/Message/UG/(\d{8})/(\d+)", re.I)


@dataclass(frozen=True)
class ListEntry:
    id: str
    digest_date: str
    category: str
    title: str
    url: str
    order: int


def create_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET",))
    session.mount("http://", HTTPAdapter(max_retries=retries))
    session.mount("https://", HTTPAdapter(max_retries=retries))
    session.headers.update({"User-Agent": "CU-Link/2.0 personal academic project; low-frequency weekly fetch"})
    return session


def candidate_dates(start: date | None = None, days: int = 63) -> list[str]:
    start = start or datetime.now().astimezone().date()
    return [(start - timedelta(days=i)).strftime("%Y%m%d") for i in range(days)]


def fetch_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=(10, 30))
    response.raise_for_status()
    if "text/html" not in response.headers.get("content-type", "text/html"):
        raise ValueError("Unexpected content type")
    return response.text


def parse_list(html: str, digest_date: str) -> list[ListEntry]:
    if not html.strip() or "No Digest Found" in html or "CUHK LOGIN" in html.upper():
        return []
    soup = BeautifulSoup(html, "html.parser")
    entries: list[ListEntry] = []
    for order, link in enumerate(soup.select('a[href*="/Digest/Message/UG/"]'), start=1):
        href = str(link.get("href", ""))
        match = MESSAGE_RE.search(href)
        if not match or match.group(1) != digest_date:
            continue
        title = " ".join(link.get_text(" ", strip=True).split())
        if not title:
            continue
        entries.append(ListEntry(match.group(2), digest_date, _find_category(link), title, urljoin(BASE, href), order))
    unique: dict[str, ListEntry] = {}
    for entry in entries:
        unique.setdefault(entry.id, entry)
    return list(unique.values())


def _find_category(link: Tag) -> str:
    panel = link.find_parent(class_=re.compile(r"panel|accordion|category", re.I))
    if panel:
        heading = panel.find(["h1", "h2", "h3", "h4"], class_=re.compile(r"title|heading", re.I)) or panel.find(
            ["h1", "h2", "h3", "h4"]
        )
        if heading and heading.get_text(strip=True):
            return " ".join(heading.get_text(" ", strip=True).split())
    previous = link.find_previous(["h1", "h2", "h3", "h4"])
    return " ".join(previous.get_text(" ", strip=True).split()) if previous else "Announcements"


def parse_detail(entry: ListEntry, html: str, fetched_at: str | None = None) -> MailItem | None:
    if "target message was already expired" in html.lower():
        return None
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = "\n".join(line.strip() for line in soup.get_text("\n").splitlines() if line.strip())
    if len(text) < 40:
        return None
    emails = re.findall(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
    urls: list[str] = []
    for anchor in soup.select("a[href]"):
        url = urljoin(entry.url, str(anchor.get("href")))
        parsed = urlparse(url)
        if parsed.scheme in {"http", "https"} and url != entry.url and "/Digest/" not in parsed.path:
            urls.append(url)
    organizer = _extract_organizer(text)
    return enrich_item(
        id=entry.id,
        digest_date=entry.digest_date,
        category=entry.category,
        title=entry.title,
        body_text=text,
        source_url=entry.url,
        application_urls=list(dict.fromkeys(urls))[:12],
        organizer=organizer,
        contact_email=emails[0] if emails else None,
        fetched_at=fetched_at,
    )


def _extract_organizer(text: str) -> str | None:
    match = re.search(r"(?:^|\n)(?:From|Organizer|主辦單位|主办单位)\s*:\s*([^\n]{2,160})", text, re.I)
    return match.group(1).strip() if match else None


def collect_digest(
    session: requests.Session,
    digest_date: str,
    delay: float = 0.7,
    skip_ids: set[str] | None = None,
) -> list[MailItem]:
    entries = parse_list(fetch_html(session, LIST_URL.format(date=digest_date)), digest_date)
    if skip_ids:
        entries = [entry for entry in entries if entry.id not in skip_ids]
    items: list[MailItem] = []
    for entry in entries:
        time.sleep(delay)
        try:
            if item := parse_detail(entry, fetch_html(session, entry.url)):
                items.append(item)
        except (requests.RequestException, ValueError):
            continue
    return items
