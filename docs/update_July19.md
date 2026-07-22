# July 19, 2026 - Website Update Log

This document records the product, interface, data, and engineering changes completed for Mass Mail Filter on July 19, 2026. The durable design rules behind these changes are maintained in [`design.md`](./design.md).

## 1. Recommendation and detail experience

- Removed the full email body and repeated application-link row from item details. Each item now exposes one verified **View original** entry in the key-information panel.
- Added canonical CUHK source-link handling and removed placeholder destinations such as `example.com/sample-ra`.
- Made **Less like this** and **More like this** persistent, mutually exclusive, and reversible. Clicking the active choice again clears only that item-level feedback.
- Made **Mark extraction incorrect** reversible as well.
- Moved feedback actions alongside the main detail content instead of leaving them below a large empty area.
- Removed item-level **One-click polish** controls from recommendation cards and detail pages; **Polish this page** remains available for batch use.
- Reworked card selection into a larger coordinated control and moved eligibility status into the metadata row.
- Reduced oversized detail titles, constrained long-title line length, and aligned content and key-information panels.
- Removed raw scoring/extraction traces and unrelated gray evidence below eligibility requirements.
- Added emoji cleanup for noisy CUHK mass-mail titles and summaries.
- Added duplicate-summary detection that catches copied title fragments even when they begin in the middle of a bilingual title, while preserving summaries that add genuine context.

## 2. Home page, navigation, and layout

- Rebuilt the recommendation controls into clearly spaced groups for mode, search, filters, sorting, eligibility scope, and score thresholds.
- Replaced the ambiguous eligibility option with a clearer **Include ineligible items** control and prevented checkbox labels from collapsing into vertical text.
- Standardized page titles, top spacing, and responsive sizing. The home title is now **机会精选 / Opportunity Highlights** and aligns with titles on other routes.
- Removed redundant eyebrow labels and promotional descriptions from page headers.
- Standardized the six Chinese navigation labels to four characters: **为你推荐、日程一览、导入邮件、归档检索、每周公告、个人设置**.
- Moved **博文约礼** into the persistent header between the CUHK MailRoute brand and navigation, and increased its size.
- Applied one shared maximum-width container and horizontal gutter system to the header and all pages so both left and right edges align.
- Reserved stable scrollbar space to prevent visible horizontal movement when switching between short and long routes.
- Added the in-flow footer text `dynamics986@2026.` to every page without using an overlay.
- Updated the Chinese font stack to a modern, readable sans-serif style.

## 3. Timeline, import, weekly announcements, and settings

- Kept timeline controls compact: **Deadlines only** no longer stretches, and **Show all (including hidden)** stays on one line as a complete control.
- Removed the redundant explanatory sentence below the Timeline title.
- Added a three-step import guide covering template access, OpenClaw export, and upload/paste preview and merge.
- Added privacy guidance explaining local parsing, browser storage, and that private email files should not be submitted to the project.
- Rewrote the import introduction in professional user-facing language and removed the internal export-format version name.
- Changed the data pipeline and scheduled GitHub Actions job to scan the most recent 28 calendar days.
- Changed Weekly Announcements to show only the four latest Digest issues, newest first, with date, indexed count, and official Digest link; individual mail content is not listed there.
- Unified Settings select-field sizing and the geometry of Save, Export, Import, and Clear local data buttons.
- Removed the separate **Prefer paid opportunities** setting. The **Paid work** goal is now the single preference source, with migration for existing local state.

## 4. Chinese and English consistency

- Extended localization so the selected interface language controls navigation, page titles, controls, filters, status text, tags, errors, tooltips, and accessibility labels across the site.
- Added localized display labels for stored taxonomy values while preserving authoritative source text, organization names, provider names, API/model IDs, and proper nouns.
- Kept **Interface Language / 界面语言** and **Goals / 目标类型** deliberately bilingual in Settings, with the active language first and normal letter spacing.
- Updated AI, import, timeline, digest, feedback, and empty-state copy in both languages.

## 5. Data interpretation and source accuracy

- Corrected compensation extraction for CUHK message `100485`: fees and price ranges are no longer treated as participant pay; the valid compensation is interpreted as HK$270 or HK$360 from the source context.
- Tightened paid-work taxonomy matching so words such as `internal` cannot be misclassified through an `intern` substring match.
- Added regression coverage for compensation context, source URLs, emoji cleanup, duplicate summaries, localization labels, feedback behavior, storage migration, and scoring.
- Refreshed the public feed to contain four available Digest dates and validated their metadata.

## 6. AI Services (Pro)

- Replaced the SiliconFlow-only configuration with a shared OpenAI-compatible client supporting DeepSeek, SiliconFlow, Alibaba Cloud Model Studio, Baidu AI Cloud Qianfan, Volcengine Ark, and Zhipu AI.
- Added independent API key, model/endpoint ID, and optional Base URL storage for every provider. Switching providers does not erase another provider's configuration.
- Added migration from the legacy SiliconFlow secret format and kept all credentials out of profile exports.
- Reworked the Settings form so provider, API key, model, Base URL, and connection-test controls share aligned widths.
- Clarified that most users should leave Base URL unchanged and edit it only when their provider supplies an alternative endpoint, proxy, or regional address.
- Fixed connection testing so it uses the current unsaved form values and works even when normal AI enhancement is disabled.
- Added an explicit testing state, a 20-second timeout, safe actionable error mapping, and a success result that shows provider, model, and the model's short reply.
- Unified polish, batch polish, and translation on the same provider-aware client and cache identity.

## 7. One-click polish token audit and optimization

The polish flow already reused a valid local cache and skipped cached items during batch processing. The request itself was further reduced without removing facts needed for a grounded result:

- Replaced the fixed first 1,600 characters of the email body with a fact-focused excerpt capped at 900 characters.
- The excerpt prioritizes compensation, deadlines, dates, eligibility, audience, and language evidence, including relevant facts that occur late in a long message.
- Removed title/summary duplicates before constructing the excerpt.
- Reduced structured requirements from eight to five and tags from eight to four.
- Capped requirement values, deadline evidence, title, and summary fields before sending them.
- Shortened the Chinese and English system prompts while retaining the same JSON contract and anti-fabrication requirements.
- Reduced the completion ceiling from 400 to 220 tokens because the response contains only a short title and structured summary.
- Continued to hash the complete cleaned source for cache validity, even though only the compact excerpt is sent. A change late in the email therefore invalidates stale cached output.
- Added tests for late-body fact selection, request size, completion limits, and full-source cache invalidation.
- Fixed batch diagnostics: page and selection polish now require an enabled AI configuration, use conservative sequential requests, and stop on a provider-wide failure instead of repeating it for every remaining card. The UI reports the safe cause and number left unprocessed.
- Unified the Settings language selector with the persistent header switch so either control updates the same saved preference and the full interface immediately.
- Subsequently removed the duplicate interface-language section from Settings. The persistent header button is now the single language control and continues to update and save the full-site preference immediately.
- Expanded the OpenAI-compatible provider registry with Kimi, ModelScope, MiniMax, Tencent Hunyuan, OpenAI, and OpenRouter; renamed Volcengine Ark to the clearer Doubao (Volcengine Ark), simplified DeepSeek's label, and added provider-specific API credential hints.

The exact token saving varies by language and provider tokenizer, but the largest variable input is now bounded at 900 characters rather than 1,600, and the maximum generated output is 45% lower. No extra AI request is made when a valid provider/model/source cache entry exists.

## 8. Verification

- `git diff --check`: passed.
- `npm test`: 10 test files and 53 tests passed.
- `npm run build`: passed.
- The build still reports dependency-level `eval`, bundle-size, and ineffective dynamic-import warnings; these are non-blocking and unrelated to the changes above.

## 9. User documentation

- Replaced the root English `README.md` with a complete guide covering product use, recommendations, feedback, scheduling, import, AI configuration, privacy, local development, data refresh, and GitHub Pages deployment.
- Added the equivalent Chinese guide in `README_zh.md`.
- Added visible English/中文 links at the top of both documents and made bilingual README maintenance part of the design requirements.
- Reworked `docs/openclaw-mail-export.md` into a structured OpenClaw workflow with a copyable prompt, field reference, date/timeline mapping, complete examples, parser behavior, troubleshooting, privacy guidance, and a final validation checklist.
- Moved long-form project documentation under `docs/` and updated README links to match the new paths.
- Added `docs/principle.md` as the user-facing source of truth for eligibility checks, five-dimensional scoring, weighted totals, category feedback, filtering, sorting, AI separation, examples, and current limitations.
