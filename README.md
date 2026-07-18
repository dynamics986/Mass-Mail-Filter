# CU Link

Private, explainable CUHK Undergraduate Digest opportunity filter.

- Local-first PWA (no accounts, no analytics; profile stays in the browser)
- Optional SiliconFlow AI for one-click polish / translation (API key in Settings / localStorage only)
- Python enrichment pipeline: clean → deadline → extractive summary → taxonomy
- Five-dimension scoring: Fit / Urgent / Value / Meaningful / Important
- Official faculty & programme list for onboarding

## Product features

- **Home search** + score sliders + taxonomy filters
- **This week** action inbox (deadlines / events in 7 days)
- **Keyboard triage**: `/` search · `j`/`k` move · `Enter` open · `h` hide · `s` save · `p` polish · `?` help
- **Bulk** hide / save / polish; hide with undo toast
- **Timeline** calendar (points & ranges), profile-filtered; deadlines-only chip
- **OpenClaw Markdown import** into Home / Timeline
- Goals editable in Settings; “show less like this” writes excluded keywords

## Develop

Requirements: Node.js 22+, Python 3.12+.

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"

python -m pipeline.faculties_scrape
# or: python -m pipeline.faculties_scrape --offline

python -m pipeline.main --migrate ../Mass-Mail-Filter/public/data/feed.json
python -m pipeline.main

npm run dev
```

For local AI polish during `npm run dev`, put the key in gitignored `.env.development.local`:

```bash
VITE_SILICONFLOW_API_KEY=sk-...
```

Or paste it in **Settings → SiliconFlow AI** (never commit keys; do not use `VITE_*` for production Pages builds).

Tests:

```bash
npm test
python -m pytest -q
```

## Deploy

GitHub Actions:

1. **Update CUHK digest data** — scheduled fetch, commits `public/data` when changed
2. **Build and deploy GitHub Pages** — Vite app after successful updates / pushes

Set Pages source to **GitHub Actions**.

## Timeline

Each opportunity carries `timeMarks` (point / range / open). Open **Timeline** for the month calendar and list.

## OpenClaw Markdown import

1. Export with [`public/templates/cu-link-mail-export.example.md`](public/templates/cu-link-mail-export.example.md)
2. Spec: [`docs/openclaw-mail-export.md`](docs/openclaw-mail-export.md)
3. App **Import** → paste/upload → Merge

## Reference

Previous implementation: `../Mass-Mail-Filter` / [dynamics986/Mass-Mail-Filter](https://github.com/dynamics986/Mass-Mail-Filter)
