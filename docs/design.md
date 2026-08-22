# Mass Mail Filter — Product and Interface Design Principles

## Purpose and maintenance

This document is the design source of truth for CUHK MailRoute. It turns product decisions into durable requirements without keeping a dated decision log.

- Update this document whenever user-visible behavior, information architecture, visual presentation, data interpretation, AI behavior, or privacy changes.
- Keep `README.md`, `README_zh.md`, `docs/openclaw_usage.md`, and `docs/principle.md` consistent with the implementation.
- Record completed implementation changes in `docs/updates.md`; keep this document focused on the reasoning that should remain true.

## Product goal

Help CUHK students identify useful opportunities from mass mail quickly, compare them with confidence, act before relevant deadlines, and return to an authoritative source when verification is needed. The product should reduce noise without hiding uncertainty or taking control away from the user.

## Product and Interface Design Principles

### 1. Clarity before feature density

- Every visible control should have an immediately understandable purpose.
- Use plain user-facing language instead of extraction, scoring, or developer terminology.
- Remove duplicated titles, summaries, metadata, links, and instructions rather than decorating repetition.
- Use progressive disclosure: cards support comparison, detail pages support decisions, and advanced settings appear only when requested.
- Keep page titles direct. Do not add decorative eyebrow text or promotional copy that repeats the page name.

### 2. The original message is authoritative

- Parsed fields, scores, and AI-polished text are reading aids; the original message remains the final authority.
- Give each item one verified **View source** action. Never invent a URL or use a placeholder destination.
- Place the source action near the title and summary where it is easy to discover; do not duplicate it in the information panel.
- If no valid source exists, state that plainly instead of rendering an inactive or misleading button.
- Do not reproduce the complete email body or repeated application-link lists on the detail page.

### 3. Accuracy before apparent completeness

- Compensation, deadlines, eligibility, organizer, category, and other facts must be grounded in source text.
- A fee, price, charge, treatment cost, or product value must not be interpreted as participant compensation.
- Matching rules must respect context and word boundaries; for example, `internal` must not match `intern`.
- Prefer an absent or uncertain value to a confidently incorrect one.
- Every extraction or cleanup correction should include a regression test based on the observed failure.

### 4. Recommendations must be understandable and reversible

- Scores are heuristic ranking aids, not probabilities, official decisions, or moral judgments.
- Show the five dimensions consistently and explain the scoring model in `docs/principle.md`.
- Eligibility states must distinguish confirmed conflicts from missing information.
- **Less like this**, **More like this**, and **Mark extraction incorrect** must be reversible and must preserve unrelated profile settings.
- Hiding, saving, selecting, filtering, and score thresholds must have clear current states and predictable reset behavior.
- A control appearing or changing state must not cause its container to jump; reserve stable space for conditional labels such as **Reset sliders**.

### 5. Professional visual hierarchy

- Use a modern sans-serif stack for interface text and a restrained display face only for major titles.
- Titles should be prominent without dominating the viewport; long bilingual titles and unbroken URLs must wrap safely.
- Related controls belong in a deliberate grid or action group with consistent alignment, height, padding, typography, and borders.
- Use color to distinguish meaning, not as the only indication of state. Green is reserved for positive or authoritative actions, warning colors for uncertainty, and purple for primary product identity.
- Keep cards balanced with stable metadata, score, and action placement.
- Tags with different semantic colors may share a row when space permits and should wrap as complete units when it does not.
- Use whitespace to clarify hierarchy, not oversized empty regions to push actions away from relevant content.

### 6. Shared layout and responsive behavior

- The header and page body use the same maximum-width container and responsive horizontal gutters.
- Reserve stable scrollbar space so route changes do not shift centered content.
- Keep navigation right-aligned on wide screens, compact it at intermediate widths, and use the established mobile navigation at narrow widths.
- Remove long header copy that competes with the brand or forces navigation to wrap.
- Desktop grids may use several columns, but they must collapse predictably to two columns and then one column.
- Controls and labels wrap as complete horizontal units; narrow columns must never create vertical text.
- On narrow screens, important actions may become full width while preserving their order and hierarchy.
- The in-flow footer must never overlap page content or mobile navigation.

### 7. Consistent, accessible interaction

- Primary and secondary actions should have at least a 44 px usable height where practical.
- Preserve semantic controls, keyboard navigation, visible focus states, accessible labels, and pressed-state attributes.
- Checkbox and radio inputs retain intrinsic dimensions; generic full-width input rules must not affect them.
- Button typography should use the shared action font variables instead of inheriting inconsistent browser or display fonts.
- Back navigation should return to the originating internal page when possible and fall back to the recommendation home page for directly opened detail links.
- Information conveyed by color must also be communicated by text, shape, icon, or state.

### 8. Complete bilingual experience

- The selected language applies to navigation, titles, controls, filters, structured labels, errors, empty states, tooltips, and accessibility text.
- The persistent header switch is the single language control and saves the preference locally.
- Chinese mode should not leak English interface metadata, and English mode should not leak Chinese interface metadata, except for intentionally bilingual anchors.
- Authoritative source content, proper names, provider names, API/model identifiers, and untranslated organization names may remain in their original language.
- Test both languages because their labels wrap differently.

### 9. Page-specific information architecture

#### Recommendation page

- Keep the hero title as **For you / 为你推荐** and the result-section title as **Curated opportunities / 机会精选**.
- Organize controls as Mode, Search, and Filters on the first row, then Sort and a two-column Score thresholds panel below; collapse responsively.
- Place **Include ineligible items** beside **Polish page** as a clearly differentiated action.
- Keep batch polishing at page level; do not add individual polish controls to cards or details.
- Use **View details** as the card's primary action, with save and dismiss as secondary actions.

#### Item detail page

- Begin with a professional outlined back button, followed directly by the title; do not repeat card status, category, or date above it.
- Place the summary, source action, and recommendation-feedback actions together before the first divider.
- Use a calm light-green source button that remains readable without overpowering the title.
- Keep the score overview compact and control the spacing between its heading and meter rows explicitly.
- Keep the side panel limited to useful facts such as category, compensation, deadline, audience, organizer, contact, and time nodes.

#### Timeline

- Place **Deadlines only** and **Show all (including hidden)** beside the month heading.
- Give both controls the same compact pill geometry and let the complete action group wrap on small screens.
- Keep the calendar legend and event markers sufficient to explain the page without an extra introductory paragraph.

#### Import

- Present three balanced steps: obtain the template, use the agent prompt, then parse and merge.
- Keep template actions in the first step, a useful copyable instruction in the second, and upload/clear actions in the third.
- Explain that parsing and storage happen locally and keep the privacy notice visually separated from the paste editor.
- Preserve template download/open, upload, paste, preview, clear, and merge capabilities.

#### Archive and settings

- Archive search should use available horizontal space and remain usable on narrow screens.
- Settings fields and action buttons use aligned dimensions; semantic color differences must not change geometry.
- **Paid work** under Goals is the single paid-opportunity preference and affects both fit and value scoring.

### 10. Local-first privacy and optional AI

- Profile data, imported content, feedback, credentials, and AI caches remain in the current browser unless the architecture explicitly changes.
- Credentials are stored separately from exportable profile state and are never included in profile exports.
- Do not imply that browser storage is encrypted or synchronized.
- AI is optional. Core extraction, eligibility, scoring, filtering, and sorting must work without it.
- Explain when email text is sent directly to a selected third-party provider and that provider charges may apply.
- Provider, API key, model ID, optional Base URL, and connection testing share one coherent settings layout.
- Switching providers must preserve independent configurations. Connection tests use the currently visible values and work independently of the global AI toggle.
- AI output must not fabricate pay, eligibility, deadlines, links, or organizers, and must not overwrite authoritative imported data.
- Cache identity includes provider, model, and the full cleaned source; batch operations reuse valid caches and stop after provider-wide failures.

### 11. Freshness, resilience, and responsible storage

- The scheduled pipeline scans a rolling 28-day source window and verifies that the latest available Digest issues are present before publication.
- Weekly digests show only the four latest issue summaries, newest first, without duplicating individual opportunity content.
- Retain the latest four issues in full and retain older items only while a meaningful deadline remains open; cleanup must not depend on discovering a new issue.
- Validation failures should stop publication and report stale or missing source dates rather than presenting a false-success update.
- The service worker may provide cached public data when the network fails. Offline and stale-data messages must describe that state honestly and point users back to the source when possible.
- Cache updates must keep generated HTML and Vite content-hashed assets together; never manually pin or rename a generated asset hash.

### 12. Discoverability without surrendering privacy

- Provide accurate canonical, description, Open Graph, Twitter Card, sitemap, manifest, and icon metadata.
- Keep application icons visually clean on browser, home-screen, and PWA surfaces, including transparent backgrounds where appropriate.
- Allow ordinary search indexing while using `robots.txt` to express restrictions for known AI-training crawlers.
- Treat crawler directives as advisory rather than a security boundary; private data must never be published in the first place.

## Acceptance checklist

- Check Chinese and English interfaces at desktop, medium, and mobile widths.
- Check long titles, unbroken URLs, absent summaries, missing source links, and empty states.
- Verify keyboard focus, accessible names, pressed states, and usable target sizes.
- Confirm that authoritative links are unique, valid, and opened with safe external-link attributes.
- Confirm that local-only data and API credentials are not exported or published.
- Run `npm test`, `npm run build`, and `git diff --check`.
- Add focused regression coverage for extraction, cleanup, scoring, storage, or pipeline changes.
