# CUHK MailRoute - Mass Mail Filter

[English](./README.md) | [中文](./README_zh.md)

CUHK MailRoute turns the CUHK Undergraduate Digest into a focused opportunity feed. It helps students compare opportunities, understand eligibility, track dates, and return to the authoritative CUHK message without reproducing the full email in the app.

## What you can do

- Rank opportunities by fit, urgency, value, meaning, and overall score.
- Filter paid work, research, activities, compensated opportunities, and items closing soon.
- Save, hide, select, and search opportunities.
- Tell CUHK MailRoute to show fewer or more opportunities of a similar type.
- Review deadlines and event dates on a timeline and calendar.
- Open the original CUHK message from one verified **View original** link.
- Import mailbox exports as Markdown and merge them into the local feed.
- Optionally polish short titles and structured summaries with your own AI API key.
- Switch the entire interface between Chinese and English from the header.

## Open the website

Use the deployed site:

[https://dynamics986.github.io/Mass-Mail-Filter/](https://dynamics986.github.io/Mass-Mail-Filter/)

The site is installable as a Progressive Web App in supported browsers. Cached public data may remain available when the network is temporarily unavailable.

## Getting started

### 1. Set up your profile

On the first visit, complete the short profile guide. CUHK MailRoute uses the selected faculty, programme, study stage, goals, and language preferences to calculate recommendation scores.

You can update these choices later under **Settings**.

### 2. Browse recommendations

Open **For You** to view ranked cards. Use the controls above the cards to:

- switch between recommendations and this week's actions;
- search titles and summaries;
- filter by opportunity type;
- sort by overall score, urgency, value, or fit;
- include items that clearly conflict with the current profile;
- set minimum score thresholds.

Each card contains a concise title and summary, useful tags, score dimensions, known compensation, deadline information, and actions for details, saving, or hiding.

### 3. Review details and the source

Select **View** to inspect the matching overview, normalized eligibility requirements, and key information. The full email body is intentionally not reproduced.

Use the single **View original** link to verify details on the authoritative CUHK page. CUHK MailRoute's extracted and AI-polished fields are reading aids and may be incomplete; the original message remains authoritative.

### 4. Improve recommendations

On an opportunity detail page:

- **Less like this** lowers similar categories in future recommendations.
- **More like this** raises similar categories.
- Select the active preference again to clear it.
- **Mark extraction incorrect** flags a parsing problem and can also be toggled off.

These item-level controls do not remove goals or exclusions chosen explicitly in Settings.

### 5. Use the schedule

Open **Timeline** to view deadlines and event dates. Use **Deadlines only** to reduce the view, or **Show all (including hidden)** when you need to review filtered items.

### 6. Search the archive and weekly issues

- **Archive** searches active, saved, hidden, and locally archived items.
- **Weekly digests** lists up to the four latest indexed Undergraduate Digest issues and links to each official CUHK announcement list.

## Importing email Markdown

The **Import** page supports local Markdown imports:

1. Download or open the Markdown template.
2. Ask OpenClaw to export mailbox messages using that structure.
3. Upload the `.md` file or paste its contents.
4. Review the parsed preview.
5. Merge the selected items into recommendations and the timeline.

Parsing happens in the browser. Imported content remains in that browser's local storage. Do not submit private mailbox files to the repository, issue tracker, or project maintainers.

## AI Services (Pro)

AI is optional. CUHK MailRoute currently supports these OpenAI-compatible providers:

- SiliconFlow
- DeepSeek
- Kimi
- Alibaba Cloud Model Studio (DashScope)
- Baidu AI Cloud Qianfan
- Doubao (Volcengine Ark)
- Zhipu AI
- ModelScope
- MiniMax
- Tencent Hunyuan
- OpenAI
- OpenRouter

### Configure AI

1. Open **Settings**.
2. Enable **AI summary & translation**.
3. Select a provider.
4. Enter that provider's API key or access token.
5. Confirm or replace the model/endpoint ID.
6. Leave **Base URL** blank unless the provider gives you a different compatible endpoint, proxy address, or regional endpoint.
7. Select **Test connection**. A successful test shows the provider, model, and the model's short reply.
8. Save the settings.

The API-key placeholder changes by provider. Not every credential starts with `sk-`; for example, ModelScope uses an Access Token and Zhipu keys may use an `ID.secret` form.

### Polish opportunities

Use **Polish this page** from the recommendation feed. CUHK MailRoute:

- skips valid cached results;
- sends only compact, fact-focused email evidence to the selected provider;
- processes requests sequentially to reduce rate-limit failures;
- stops after a provider-wide authentication, permission, quota, model, network, or response error;
- reports the cause and the number of items left unprocessed.

Changing the provider, model, or source text invalidates the corresponding cache. AI output never replaces the original imported source.

### AI privacy and cost

Provider credentials and AI caches are stored in the current browser and are excluded from profile export. When polish or AI translation runs, relevant email text is sent directly from the browser to the selected provider and may incur provider charges.

Browser local storage is not an encrypted credential vault. Use a restricted API key with a spending limit where the provider supports it, and avoid configuring keys on shared or untrusted devices.

## Local data and privacy

CUHK MailRoute is a browser-only application. The following data is stored locally:

- profile and recommendation preferences;
- saved, hidden, and imported opportunities;
- item feedback and extraction flags;
- AI provider configuration and credentials;
- AI polish cache;
- a cache of the public CUHK feed.

Use **Export** in Settings to back up the exportable profile state. API credentials are deliberately excluded. **Clear local data** resets the locally stored profile, preferences, saved items, and imported items in the current browser.

## Run locally

Requirements:

- Node.js 22 or later
- npm

```bash
npm install
npm run dev
```

Open the local address printed by Vite, normally [http://localhost:5173/](http://localhost:5173/).

Run verification before submitting changes:

```bash
npm test
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Refresh public Digest data

The Python pipeline fetches public CUHK Undergraduate Digest pages, validates and enriches records, removes sample entries, and retains the latest four Digest issues plus still-active opportunities.

Requirements:

- Python 3.12
- packages from `requirements.txt`

```bash
python -m pip install -r requirements.txt
python -m pytest -q tests
python -m pipeline.main --lookback-days 28
```

Fetch a specific issue with a `YYYYMMDD` date:

```bash
python -m pipeline.main --date 20260717
```

The **Update CUHK digest data** GitHub Actions workflow runs on a schedule and can also be started manually. It tests the pipeline, checks the recent 28-day window, and commits `public/data` only when the feed changes.

## GitHub Pages deployment

The **Build and deploy GitHub Pages** workflow:

1. installs dependencies with `npm ci`;
2. runs the test suite;
3. creates the production build;
4. deploys `dist/` to GitHub Pages.

It runs after pushes to configured deployment branches, through manual dispatch, and after a successful data-update workflow.

For a fork, enable GitHub Pages with **GitHub Actions** as the source and update repository or workflow settings as needed. Vite uses a relative base path so the generated site works under a repository subpath.

## Project documentation

- [`docs/design.md`](./docs/design.md) - product and interface design requirements.
- [`docs/principle.md`](./docs/principle.md) - current Mass Mail eligibility, scoring, personalization, filtering, and ranking principles.
- [`docs/openclaw_usage.md`](./docs/openclaw_usage.md) - detailed OpenClaw Markdown export and import guide.
- [`docs/update_July19.md`](./docs/update_July19.md) - July 19, 2026 implementation log.
- [`README_zh.md`](./README_zh.md) — Chinese usage guide.

When changing user-visible behavior, update `docs/design.md` and the relevant usage documentation in the same change.
