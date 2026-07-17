# CU Link — CUHK Mass Mail Filter

CU Link is a bilingual, installable PWA that collects the public CUHK Undergraduate Weekly Digest and ranks opportunities against a private on-device profile. It does not use AI, accounts, analytics, or a server-side user database.

## What it does

- Finds a digest even when a holiday moves publication from Friday to Thursday.
- Probes the previous 35 days on first run to backfill up to four available weekly issues.
- Archives message text before CUHK detail links expire.
- Extracts compensation, deadlines, tags, and explicit eligibility requirements.
- Distinguishes a native-language requirement from general language ability.
- Explains every recommendation score and eligibility decision.
- Stores profile, hidden items, favorites, and corrections only in `localStorage`.
- Keeps the latest four issues plus older opportunities with future deadlines.
- Works offline with the most recent validated feed.

The bundled feed contains demonstration records so the interface is useful before the first scheduled fetch. Running the scraper replaces or augments them with public CUHK data.

## Local development

Requirements: Node.js 22+, Python 3.12+.

```bash
npm install
npm run dev
```

In another terminal:

```bash
python -m pip install -r requirements.txt
python -m scraper.main --date 20260710
pytest -q
```

Build and unit test:

```bash
npm test
npm run build
```

Playwright is configured separately with `npm run test:e2e`; install its browser only when local end-to-end testing is required.

## Automatic updates and GitHub Pages

1. Create a GitHub repository and push this folder to the `main` branch.
2. In repository settings, set Pages **Source** to **GitHub Actions**.
3. Ensure workflow permissions allow Actions to write repository contents.
4. Run **Update CUHK digest data** manually once, optionally supplying `YYYYMMDD`.

The updater runs at 13:15 Hong Kong time on Thursday and Saturday, and at 13:15, 15:15, and 18:15 on Friday. It commits only when new items are found. A failed or empty fetch never overwrites the last valid feed.
After a successful updater run, the Pages workflow runs again from the latest `main` branch so data commits made by `GITHUB_TOKEN` are published without relying on a second `push` event.

## Rule maintenance

- Extraction rules: `scraper/rules.py`
- Browser-side scoring and eligibility: `src/lib/ranking.ts`
- Static public data contract: `src/types.ts` and `scraper/models.py`

Every eligibility decision must retain a short evidence excerpt. Do not add inferred sensitive traits or render source HTML directly.

## Privacy and limitations

All profile information stays in the browser. Exported settings files may contain information the user entered, so they should be handled privately. Automatic rules can misunderstand unusual wording; the app exposes evidence and always links to the original message for final verification.
