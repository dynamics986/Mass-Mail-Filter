from __future__ import annotations

import re

CHROME_PATTERNS = [
    r"^Mass Mail System\s*",
    r"Digest of CUHK Mass Mails for Undergraduate Students\s*",
    r"^»\s*",
    r"^View Count\s*",
    r"For request submissions, please submit them at.*",
    r"For enquiries, please write to:.*",
    r"Copyright © \d{4}\. All Rights Reserved\. The Chinese University of Hong Kong\.\s*",
    r"^/weekly/\s*",
    r"For comments and enquiries related to this message, please send to\s*",
    r"^-{10,}\s*",
]

CHROME_RE = [re.compile(p, re.I | re.M) for p in CHROME_PATTERNS]
SEPARATOR_RE = re.compile(r"^-{20,}\s*$", re.M)


def strip_cuhk_chrome(text: str) -> str:
    """Remove Mass Mail page chrome that pollutes extraction."""
    cleaned = text.replace("\r\n", "\n")
    # Prefer content after the long dash separator (real body usually follows).
    parts = SEPARATOR_RE.split(cleaned)
    if len(parts) >= 2:
        cleaned = max(parts[1:], key=len)
    for pattern in CHROME_RE:
        cleaned = pattern.sub("", cleaned)
    # Drop trailing service desk boilerplate if still present.
    for marker in ("View Count", "For request submissions", "Copyright ©"):
        idx = cleaned.find(marker)
        if idx > 200:
            cleaned = cleaned[:idx]
    lines = [ln.strip() for ln in cleaned.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines).strip()


def try_talon_extract(text: str) -> str:
    """Optionally strip quotations/signatures via Mailgun talon."""
    try:
        import talon  # type: ignore
        from talon import quotations, signature  # type: ignore

        talon.init()
        body = quotations.extract_from_plain(text) or text
        unsigned, _ = signature.extract(body, sender="noreply@cuhk.edu.hk")
        return (unsigned or body).strip()
    except Exception:
        return text


def clean_body(raw: str) -> str:
    base = strip_cuhk_chrome(raw)
    return try_talon_extract(base) or base
