# Mass Mail Filter - Product and Interface Design Principles

## Purpose and Maintenance

This document is the design source of truth for Mass Mail Filter. It translates user feedback into durable product, interface, content, data, privacy, and engineering requirements.

Every change that affects user-visible behavior, information architecture, visual presentation, data interpretation, AI behavior, privacy, or interaction patterns must update this document in the same change. When a new requirement conflicts with an older one, record the decision here and update the relevant acceptance criteria. Do not let the implementation and this document drift apart.

Maintain matching user guides in `README.md` (English) and `README_zh.md` (Chinese). Both documents must provide a visible language-switch link to the other version, and user-facing workflow or privacy changes must be reflected in both guides.

Keep `docs/openclaw-mail-export.md` aligned with the actual Markdown parser and Import interface. It must distinguish required and optional fields, document timeline mapping and local-storage behavior, require authoritative source links, discourage invented values, and include privacy guidance plus a usable OpenClaw prompt.

Keep `docs/principle.md` synchronized with the implemented eligibility checks, five scoring dimensions, default weights, category-feedback overlay, filtering order, and sorting behavior. It must state that scores are heuristic ranking aids rather than probabilities or official decisions, and document known limitations without overstating accuracy.

The change log at the end should be updated whenever a material design decision is added, removed, or revised.

## Product Goal

Help CUHK students quickly identify useful opportunities from mass mail without forcing them to read every message. The product should reduce noise, explain why an item is relevant, preserve access to the authoritative original message, and keep user data under the user's control.

The interface should feel calm, professional, readable, and trustworthy. It should not expose internal extraction terminology, scoring implementation details, raw model output, or developer-oriented labels to ordinary users.

## Core Principles

### 1. Clarity before feature density

- Every visible control must have an immediately understandable purpose.
- Prefer plain, user-facing language over internal labels such as `[fit]`, `[value]`, `unknown`, or extraction/debug terminology.
- If a control may be misunderstood, give it a short explanation near the control rather than relying on documentation elsewhere.
- Remove redundant or low-value content instead of adding more visual hierarchy around it.
- Avoid repeating the same title, summary, evidence, or link in multiple parts of a page.

### 2. The original message is authoritative

- Each item must provide one clear **View original** entry that opens the correct CUHK mass-mail page or another verified source URL.
- Never substitute placeholder destinations such as `example.com` for a real source.
- Do not invent a source URL when a valid one cannot be established.
- The item detail page must not reproduce the full email body or list repeated application links. Users verify source material through the single original-message entry.
- Parsed and AI-generated fields are aids, not authoritative facts. When interpretation is uncertain, show uncertainty rather than false precision.

### 3. Data accuracy over apparent completeness

- Compensation, deadlines, eligibility, organizer, category, and other structured facts must be grounded in the source text.
- Do not classify a price, fee, service charge, product value, or treatment cost as participant compensation.
- Extraction rules must respect word boundaries and context; for example, `internal` must not match `intern`.
- Prefer a missing or uncertain value to a confidently wrong value.
- Corrections to extraction logic should include a regression test based on the failure case.

### 4. Progressive disclosure

- Recommendation cards show only the information needed to compare opportunities: category/date, eligibility status, score, concise title and summary, useful tags, score dimensions, compensation, deadline, and primary actions.
- Detailed reasoning and evidence may be expandable, but raw scoring traces and technical tags must not be shown by default.
- The detail page should prioritize the matching overview, concise eligibility requirements, and a compact key-information panel.
- Advanced AI settings such as Base URL should remain collapsed until requested.

### 5. Consistent, reversible interactions

- Preference actions must be reversible and visually reflect their current state.
- **Less like this** and **More like this** are mutually exclusive. Clicking the active choice again clears only that item-level feedback.
- Clearing item-level feedback must not remove targets or exclusions explicitly configured in Settings.
- **Mark extraction incorrect** must also support toggling off.
- Selection controls must be large enough to use comfortably and visually belong to the card. Avoid tiny, browser-default checkboxes.
- Selected, focused, saved, excluded, and uncertain states must be distinguishable without depending on color alone.

### 6. Professional visual hierarchy

- Use a modern Chinese sans-serif stack with compatible Latin fallbacks. Avoid decorative or calligraphic Chinese fonts for headings or onboarding copy.
- Titles must be prominent but not dominate the viewport. Use responsive `clamp()` sizing and sensible maximums.
- Labels such as Mode, Search, Filters, and Sort must have clear spacing from their controls.
- Related controls should be grouped inside a deliberate toolbar or panel, aligned to a consistent grid.
- Pill controls should share height, padding, typography, border treatment, and selected-state behavior.
- Select controls should use the full width of their grid column with a comfortable minimum height and internal padding; browser-default compact sizing must not make profile fields feel cramped.
- The four Settings actions—Save, Export, Import, and Clear local data—must use equal column widths, height, font size, weight, and padding. Their semantic color differences must not change their geometry.
- Compact buttons must retain their intrinsic height and width; neighboring wrapped labels must never stretch them into oversized blocks.
- Do not allow narrow grid columns to turn ordinary labels into vertical text.
- Cards should have clear alignment lines, balanced padding, and stable action placement.
- Eligibility labels such as **Eligible** and **Needs confirmation** belong with card metadata, not floating at an arbitrary visual center.
- Use whitespace to separate sections; do not use oversized empty areas to push controls to the bottom of the screen.
- Secondary pages should begin directly with one clear page title. Do not place decorative eyebrow text above it when that text merely repeats the page name, source, privacy claim, or navigation category.
- Page titles and their introductory copy must share one left edge and use a consistent vertical rhythm; avoid negative margins that make title blocks feel crowded or misaligned.
- Show the university motto once in the persistent header, positioned between the CU Link brand and primary navigation, so it is available consistently without competing with page titles.
- The persistent header and every page body must use the same maximum-width container and identical horizontal gutters. Their left and right content edges must align; flexible whitespace belongs only inside the shared boundaries.
- The home title and secondary-page titles must share the same top offset, responsive font size, line height, and margin. Do not give the home hero a separate title scale.
- Reserve stable vertical-scrollbar space across routes so switching between short and long pages never shifts the shared centered container horizontally.
- Do not repeat the product source label or motto inside the home hero or onboarding content.
- Keep the six primary Chinese navigation labels at four characters for a balanced header: 为你推荐、日程一览、导入邮件、归档检索、每周公告、个人设置. Page titles must use the same names as navigation.
- Show `dynamics986@2026.` once in a centered, in-flow footer on every page. The footer must follow page content and must never use a fixed overlay that can cover text, controls, or mobile navigation.

### 7. Responsive and accessible by default

- Desktop layouts may use multiple columns, but they must collapse predictably to two columns and then one column on narrower screens.
- Controls must wrap as complete units. Text must remain horizontal and readable.
- Checkbox and radio inputs must keep their intrinsic width; generic full-width text-input rules must never apply to them.
- Interactive targets should be comfortably clickable or tappable.
- Preserve keyboard navigation, visible focus states, semantic labels, and `aria-pressed`/equivalent state where appropriate.
- Information conveyed by color must also have text, shape, icon, or state semantics.
- Chinese and English layouts must both be checked because translated strings have different lengths.

### 8. Complete interface localization

- The selected interface language applies to the entire product, including navigation, page eyebrows, form options, category labels, tags, controls, empty states, errors, tooltips, titles, and accessibility labels.
- The persistent header language switch is the single interface-language control. Apply it immediately across the full site and persist the preference locally; do not repeat the control in Settings.
- Chinese mode must not show English UI metadata or bilingual UI labels; English mode must not show Chinese UI metadata, except for the deliberately bilingual **Goals / 目标类型** anchor in Settings.
- The bilingual Goals anchor should put the active interface language first, use normal title case, and avoid wide all-caps letter spacing.
- Brand names, provider names, API/model identifiers, established abbreviations, organization names, programme names without an available translation, and original email content may remain in their authoritative language.
- Source titles and summaries are content rather than interface chrome and must not be destructively machine-translated merely to satisfy interface localization.
- When a structured value has a maintained translation (for example taxonomy, domain, role, language, year, or student level), always render the localized label instead of its stored internal value.

## Page Requirements

### Recommendation page

- The page introduction should be concise and use restrained responsive typography.
- The controls area should present Mode, Search, Filters, Sort, eligibility scope, and score thresholds as clearly separated groups.
- The eligibility option should be named **Include ineligible items**, with a short explanation that items clearly conflicting with the user's profile are hidden by default.
- Do not use the ambiguous label **Show ineligible** without context.
- The controls grid must not create narrow columns that stack label characters vertically.
- Recommendation cards must not contain an individual **One-click polish** button.
- Keep **Polish this page** as the batch action.
- Card selection should use a coordinated, adequately sized selection button and a clear selected state.
- Keep the main card action hierarchy simple: View details is primary; save and dismiss are secondary.
- Remove decorative emoji noise from CUHK titles and summaries while preserving meaningful symbols when possible.

### Item detail page

- Do not display the full original email body.
- Do not render `applicationUrls` or a bottom link list.
- Show one verified **View original** link in the key-information panel.
- Use a restrained title size and a defined content width so long bilingual titles wrap cleanly.
- Suppress a summary when it substantially duplicates the title.
- Eligibility requirement rows should show the normalized requirement and status only. Do not show unrelated gray extraction fragments beneath them.
- Do not expose technical score evidence such as `[fit] Eligibility: unknown` or `[value] Has compensation`.
- Place feedback actions near the content/key-information area rather than at the bottom of a large empty page.
- Do not show an item-level **One-click polish** control on this page.

### Timeline page

- Keep **Deadlines only** as a compact pill rather than allowing it to stretch to the height or width of adjacent controls.
- Keep **Show all (including hidden)** on one line and wrap the complete control to the next row when horizontal space is insufficient.
- Timeline filter pills must preserve intrinsic width, consistent height, and horizontal label text at every supported viewport size.
- Do not place a redundant explanatory sentence between the Timeline title and its filters; the calendar legend and controls should explain the interaction directly.

### Weekly digests page

- The data pipeline must probe the most recent 28 calendar days by default so the feed can include four weeks of public Undergraduate Digest content.
- The scheduled GitHub Actions data update must explicitly run with the 28-day lookback rather than depending only on a local CLI default.
- Show at most the four most recent available Digest issues, newest first.
- Each issue is one summary card containing only its date, indexed-item count, and a link to the official CUHK Digest announcement list.
- Do not expand or enumerate individual mail items on the Weekly digests page; users access individual source messages from opportunity details.

### Onboarding and profile

- The Chinese heading equivalent to **First, tell us who you are** must use the same modern, readable sans-serif design language as the rest of the product.
- Explain requested profile fields in terms of recommendation benefit.
- Avoid asking for data that is not needed for matching.
- Use **Paid work** under Goals as the single control for paid-opportunity preference. Do not show a separate **Prefer paid opportunities** checkbox; the goal must influence both fit and value scoring.
- Migrate a legacy enabled `preferPaid` value into the Paid work goal, then omit the obsolete field from newly saved or exported profile state.

### Import page

Before the editor, show a three-step guide:

1. Download or open the Markdown template.
2. Ask OpenClaw to export email using that template.
3. Upload or paste the content, preview the parsed result, and merge it.

The page must also explain that:

- parsing happens locally;
- imported content is stored in the browser;
- users should not submit private email files to the project or its maintainers.

Keep template download/open, file upload, paste, preview, and merge features available.

The introductory sentence should use professional user-facing language, omit internal export-format version names, and remain on one line without changing the page's horizontal alignment.

### AI settings

- AI is optional and globally switchable.
- Present the feature group as **AI Services (Pro)** in both interface languages.
- Support the maintained OpenAI-compatible registry: SiliconFlow, DeepSeek, Kimi, Alibaba Cloud Model Studio (DashScope), Baidu AI Cloud Qianfan, Doubao (Volcengine Ark), Zhipu AI, ModelScope, MiniMax, Tencent Hunyuan, OpenAI, and OpenRouter.
- Select the provider first, then show that provider's independently stored API key, editable model ID, and collapsible Base URL override.
- API-key placeholders must be provider-specific. Use a known prefix example only when that provider documents a recognizable format; otherwise identify the credential by name (for example, ModelScope Access Token) instead of implying that every key starts with `sk-`.
- Switching providers must not erase other provider configurations.
- API credentials remain local and must never be included in profile export.
- Migrate legacy SiliconFlow credentials automatically.
- Connection testing must use the unsaved values currently visible in the form.
- Connection testing must work independently of the global AI-enabled toggle; that toggle controls normal AI usage, not credential validation.
- Success feedback should identify the provider and model.
- During a test, disable the button and show a live testing state. On success, show the provider, model, and the model's short reply so the user can verify that a real completion occurred; time out with actionable feedback after 20 seconds.
- Error messages must safely map authentication, permission/model, rate-limit, network/CORS, and malformed-response failures to actionable bilingual guidance. Never display a complete response body that might contain sensitive data.
- Provider, API Key, model/endpoint, and Base URL controls must share one appropriate maximum width and aligned left/right edges; the connection-test action aligns with the model field and becomes full-width only on narrow screens.
- Explain Base URL in plain language: most users should leave it blank to use the selected provider's official default address, and should edit it only for a provider-supplied alternative, proxy, or different regional endpoint.

## AI-assisted Content Rules

- Polish rewrites a short title and structured summary; it must not overwrite original imported data.
- Explain near the relevant batch action that associated email text is sent to the currently selected AI provider and the result is cached locally.
- Re-polishing remains possible.
- Polish, batch polish, and translation must use the same provider configuration and shared OpenAI-compatible client.
- Cache identity must include provider and model so results are not reused after either changes.
- Reuse a valid per-item cache before making any AI request, and skip cached items during page/batch polish.
- Page and selection polish must require an enabled, complete AI configuration; do not silently substitute a public translation service for a disabled AI provider.
- Batch polish should run conservatively and stop after a provider-wide authentication, permission, model, quota, network, timeout, or response error. Show the safe actionable reason and unprocessed count instead of repeating the same failing request for every item.
- Minimize polish input tokens by sending structured extracted facts plus a compact source excerpt selected for compensation, deadline, audience, language, and eligibility evidence instead of a fixed long body prefix.
- Keep the polish prompt concise and cap completion length to the structured title/summary requirement. Token reduction must not remove source-grounded pay, deadline, or eligibility facts.
- Hash the full locally cleaned source for cache validity even though only a compact excerpt is sent, so changes later in an email cannot incorrectly reuse an old result.
- AI output must not fabricate compensation, eligibility, deadlines, links, or organizers.
- If AI output conflicts with deterministic source extraction, the UI should preserve uncertainty and access to the original message.

## Local Data and Privacy

- The site remains a browser-only application unless a later requirement explicitly changes the architecture.
- Profile, preferences, imported content, feedback, credentials, and AI caches are local browser data.
- Credentials and secrets must be separated from exportable profile state.
- Copy must clearly disclose when email content is sent to a third-party AI provider.
- Do not imply that local storage is encrypted or synchronized unless it actually is.

## Content Cleanup

- Strip repeated decorative emoji and attention-grabbing emoji runs from mass-mail titles and summaries when they impair readability.
- Preserve meaningful text and do not damage URLs, monetary values, dates, names, or language content during cleanup.
- Remove duplicated title fragments from summaries.
- Treat a long summary fragment copied from any position within a title as redundant, not only copies that begin with the title's first character.
- Preserve summaries that add substantive context such as a team introduction, study purpose, participation details, or other information absent from the title.
- Do not show raw extraction evidence under normalized eligibility requirements.
- Replace developer-facing unknown values with clear user language such as **Not specified** or **Needs confirmation**, depending on context.

## Acceptance Checklist

For every relevant UI or behavior change, verify:

- Chinese and English interfaces.
- Desktop, medium-width, and narrow/mobile layouts.
- No vertical labels or overflowing controls.
- Clear keyboard focus and usable target sizes.
- Original-message links are unique, correct, and non-placeholder.
- Titles and summaries are non-redundant and free of distracting emoji noise.
- No technical extraction/scoring labels leak into the user interface.
- Preference toggles are reversible and persist after refresh.
- Existing Settings targets/exclusions survive item-feedback changes.
- AI credentials are excluded from profile export.
- Provider/model cache separation works.
- Markdown parse preview and merge still work.
- `npm test`, `npm run build`, and `git diff --check` pass.
- Extraction changes include focused regression coverage.

## Decision Log

### 2026-07-19 — Initial design baseline

- Consolidated the product and interface requirements gathered from iterative user review.
- Established the original CUHK message as the single authoritative source link.
- Removed full body content, repeated application links, raw scoring evidence, redundant eligibility evidence, decorative emoji noise, and item-level polish controls.
- Defined reversible preference feedback and coordinated card selection behavior.
- Established professional responsive toolbar, typography, spacing, and card-layout rules.
- Documented the local-first, multi-provider AI configuration and privacy model.
- Added the requirement that future material design changes update this document in the same change.

### 2026-07-19 — Compact controls and timeline filters

- Required checkbox and radio controls to retain intrinsic width across all pages.
- Prevented wrapped labels from stretching adjacent pill buttons.
- Defined single-line, whole-control wrapping behavior for timeline visibility filters.

### 2026-07-19 — Four-week Digest archive

- Changed the default Digest crawl window to the most recent 28 calendar days.
- Made the GitHub Actions update workflow explicitly request the 28-day crawl window on every scheduled deployment update.
- Limited Weekly digests to four issue summary cards in reverse chronological order.
- Removed individual mail listings from the Weekly digests page.

### 2026-07-19 — Whole-site language consistency

- Required the selected language to cover all interface chrome, structured labels, options, errors, and accessibility text.
- Localized taxonomy, tag, year, student-level, page-eyebrow, score, settings, onboarding, timeline, and import UI metadata.
- Clarified that authoritative source content and proper names remain unchanged when no maintained translation exists.

### 2026-07-19 — Pro AI settings presentation

- Renamed the settings group to **AI Services (Pro)** and simplified the local API-key privacy copy.
- Aligned all AI configuration fields to a shared, restrained width and stabilized the model/test-button layout.
- Replaced the ambiguous Base URL note with actionable bilingual guidance.

### 2026-07-19 — Title/summary redundancy detection

- Extended duplicate-summary detection to catch truncated sections copied from the middle of long bilingual titles.
- Applied the rule in both runtime card rendering and the ingestion pipeline while preserving summaries with genuinely new context.

### 2026-07-19 — Simplified secondary-page headings

- Removed repetitive decorative eyebrow labels from Archive, Weekly digests, Settings, Timeline, Import, and onboarding.
- Standardized page-title and introduction spacing without negative margins so heading blocks align cleanly.

### 2026-07-19 — Persistent header motto

- Removed the Undergraduate Digest eyebrow and motto from the home hero, and removed the duplicate onboarding motto.
- Placed the localized motto between the CU Link brand and primary navigation in the persistent header on every page.

### 2026-07-19 — Global copyright footer

- Added `dynamics986@2026.` to a shared bottom-center footer on every page.
- Kept the footer in normal document flow and added mobile navigation clearance so it cannot obscure content.

### 2026-07-19 — Shared page alignment and refined home title

- Unified header and body under one 1400px maximum-width container with shared responsive gutters.
- Increased the header motto and footer credit sizes, and removed the copyright symbol from the credit.
- Replaced the direct home headline with the concise **Curated opportunities** / **机会精选**.

### 2026-07-19 — Unified page-title system

- Unified the home and secondary-page title position, responsive size, line height, and spacing.
- Removed the home ranking-description paragraph and the redundant **Recent & open** label above the recommendation feed.

### 2026-07-19 — Concise Timeline and Import introductions

- Removed the redundant explanatory sentence beneath the Timeline title.
- Rewrote the Import introduction as one professional single-line instruction and removed the internal export-format version name.

### 2026-07-19 — More comfortable select controls

- Increased select-field height and internal spacing across Settings and onboarding while retaining full-column width and aligned two-column edges.
- Increased profile-form row and column gaps for clearer field separation.

### 2026-07-19 — Bilingual Settings anchors

- Made Interface Language and Goals bilingual in both interface modes, with the active language shown first.
- Replaced wide all-caps tracking on those labels with compact title-case typography.

### 2026-07-19 — Balanced four-character navigation

- Renamed 时间线 to 日程一览 and 设置 to 个人设置 so all six primary Chinese navigation labels use four characters without changing their function.
- Kept navigation and page-title terminology synchronized.

### 2026-07-19 — Uniform Settings action buttons

- Standardized the four Settings action buttons to equal width, height, typography, and spacing.
- Added a two-column mobile layout and a single-column layout for very narrow screens.

### 2026-07-19 — Stable route transitions

- Reserved the vertical scrollbar gutter globally so short pages such as Weekly digests and long pages use the same viewport width and horizontal alignment.

### 2026-07-19 — Consolidated paid-work preference

- Removed the redundant Prefer paid opportunities checkbox from Settings.
- Made the Paid work goal the sole preference input for both fit and value scoring, with legacy local-state migration.

### 2026-07-19 — Observable AI connection testing

- Decoupled connection testing from the optional global AI-enabled switch and kept it bound to the current unsaved form configuration.
- Added an in-progress disabled state, a 20-second timeout, styled success/error feedback, and the model's actual short reply in successful results.

### 2026-07-19 — Lower-token one-click polish

- Preserved provider/model-aware item caching and cached-item batch skipping as the primary call-reduction mechanism.
- Replaced the fixed 1600-character body prefix with a maximum 900-character fact-focused excerpt drawn from the full email.
- Compacted the system instructions, reduced tags/requirements/evidence payload limits, and lowered polish completion capacity from 400 to 220 tokens.
- Expanded cache source hashing from the first 800 body characters to the complete cleaned local source.
