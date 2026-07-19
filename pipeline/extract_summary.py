from __future__ import annotations

import re

SKIP_LEAD = re.compile(
    r"^(dear\s+|hi\s+|hello\s+|please\s+find|thank you|感謝|敬啟者|各位同學|"
    r"for comments and enquiries|mass mail)",
    re.I,
)


def _comparable(value: str) -> str:
    return re.sub(r"[\W_]+", "", value, flags=re.UNICODE).casefold()


def is_redundant_summary(title: str, summary: str) -> bool:
    """Detect title copies, including truncated sections from their middle."""
    title_key = _comparable(title)
    summary_key = _comparable(summary)
    if not title_key or not summary_key:
        return False
    if title_key in summary_key:
        return True
    return len(summary_key) >= 40 and summary_key in title_key


def _sentences(text: str) -> list[str]:
    chunks = re.split(r"(?<=[。！？.!?])\s+|\n+", text)
    out: list[str] = []
    for chunk in chunks:
        s = re.sub(r"\s+", " ", chunk).strip()
        if len(s) < 20 or len(s) > 320:
            continue
        if SKIP_LEAD.search(s):
            continue
        out.append(s)
    return out


def lead_sentence(text: str) -> tuple[str, list[str]]:
    for s in _sentences(text):
        return s, [s]
    # Fallback: first non-empty line
    for line in text.splitlines():
        line = line.strip()
        if len(line) >= 12:
            return line[:280], [line[:280]]
    return "", []


def _sumy_summary(text: str, sentence_count: int = 2) -> list[str]:
    try:
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.summarizers.lex_rank import LexRankSummarizer
    except Exception:
        return []

    # Prefer Chinese tokenizer when CJK dominates.
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    lang = "chinese" if cjk > len(text) * 0.2 else "english"
    try:
        parser = PlaintextParser.from_string(text, Tokenizer(lang))
        summarizer = LexRankSummarizer()
        sentences = [str(s).strip() for s in summarizer(parser.document, sentence_count)]
        return [s for s in sentences if s]
    except Exception:
        return []


def extract_summary(clean_text: str, max_chars: int = 280) -> tuple[str, list[str]]:
    """Extractive summary: LexRank → lead sentence → empty."""
    if not clean_text.strip():
        return "", []
    picked = _sumy_summary(clean_text, 2)
    if not picked:
        return lead_sentence(clean_text)
    summary = " ".join(picked)
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rstrip() + "…"
    return summary, picked


def extract_key_phrases(text: str, top: int = 6) -> list[str]:
    try:
        import yake
    except Exception:
        return []
    try:
        kw = yake.KeywordExtractor(lan="en", n=2, top=top)
        pairs = kw.extract_keywords(text[:5000])
        return [p[0] for p in pairs if p[0]]
    except Exception:
        return []
