# Exporting Mail from OpenClaw to CUHK MailRoute

OpenClaw can convert mailbox messages into a Markdown file that CUHK MailRoute parses in the browser. Imported opportunities can then appear in **For you**, **Timeline**, and **Archive** alongside the public CUHK Digest feed.

> **Privacy first**: Parsing and storage happen in the current browser. The exported Markdown may still contain private email content. Keep it on a trusted device, and never commit it to Git, attach it to a public issue, or send it to project maintainers.

## Contents

- [Quick start](#quick-start)
- [Prompt for OpenClaw](#prompt-for-openclaw)
- [Markdown format](#markdown-format)
- [Field reference](#field-reference)
- [Dates and timeline behavior](#dates-and-timeline-behavior)
- [Complete example](#complete-example)
- [Import behavior](#import-behavior)
- [Troubleshooting](#troubleshooting)
- [Final checklist](#final-checklist)

## Quick start

1. In CUHK MailRoute, open **Import**.
2. Select **Download template** or **Open template**.
3. Ask OpenClaw to read the relevant mailbox or Mass Mail folder and produce Markdown using the downloaded structure.
4. Remove any example items and retain only real messages you intend to import.
5. Upload the `.md` file or paste its contents into CUHK MailRoute.
6. Select **Parse preview** and check the titles, summaries, dates, and item count.
7. Select **Merge** only after the preview is correct.

No AI API key is required to parse or import Markdown. AI credentials are needed only if you later enable optional polish or translation.

## Prompt for OpenClaw

Adapt the following instruction. Replace the mailbox scope and date range before running it.

```text
Read the messages in [MAILBOX OR FOLDER] received between [START DATE] and
[END DATE]. Export only opportunity-related messages that I am allowed to
process.

Use the CUHK MailRoute Markdown format below. Create one "## Item:" block per email.
Preserve factual amounts, dates, eligibility, organizer names, contact email,
and the authoritative original-message URL. Do not invent missing values.

Rules:
- Use YYYY-MM-DD for every date.
- Keep the title faithful but remove repeated decorative emoji.
- Write a one- or two-sentence extractive summary that adds information beyond
  the title.
- Put the readable plain-text email in "### Body"; remove signatures, tracking
  pixels, repeated legal footers, and quoted reply chains where possible.
- Use a stable message ID when available.
- Use the original CUHK message URL for "source". Never use example.com or an
  invented URL.
- Leave an unknown optional field blank or omit it.
- Do not include passwords, authentication links, private access tokens, or
  unrelated personal correspondence.

Return Markdown only. Do not wrap the file in another Markdown code fence.
```

Give OpenClaw the template from `public/templates/cu-link-mail-export.example.md` after this instruction.

## Markdown format

The file needs either the export marker or at least one `## Item:` heading. Keeping both is recommended.

```markdown
# CUHK MailRoute Mail Export
<!-- cu-link-export: v1 -->

## Item: Opportunity title
- id: stable-message-id
- date: YYYY-MM-DD
- from: Organizer name
- email: contact@example.edu
- deadline: YYYY-MM-DD
- event: YYYY-MM-DD to YYYY-MM-DD
- start: YYYY-MM-DD
- end: YYYY-MM-DD
- tags: research, helper
- source: https://authoritative.example/message
- apply: https://authoritative.example/application

### Summary
One or two factual sentences that add useful context beyond the title.

### Body
Readable plain-text message content.
```

Each opportunity must begin with `## Item:`. Its metadata, `### Summary`, and `### Body` belong only to that item.

## Field reference

### Required content

| Field | Format | Guidance |
|---|---|---|
| `## Item:` | Text heading | The opportunity title. It must not be empty. |
| `date` | `YYYY-MM-DD` | Published or received date. If omitted, CUHK MailRoute uses the import date, so an explicit value is strongly recommended. |
| `### Body` | Plain text | Source text used for local parsing, categorization, summaries, and optional AI polish. Keep relevant facts. |

The `### Summary` section is strongly recommended. When it is absent, CUHK MailRoute derives a short summary from the first substantial body line.

### Optional metadata

| Field | Accepted value | How CUHK MailRoute uses it |
|---|---|---|
| `id` | Stable unique text | Used for merge deduplication. If absent, CUHK MailRoute generates an ID from the title and item position. |
| `from` | Organizer name | Displayed as organizer information. |
| `email` | Email address | Displayed as the contact email. |
| `deadline` | One date | Creates an application-deadline mark and the card deadline. |
| `event` | One date or date range | Creates an event point or event range on the timeline. |
| `start` | One date | Creates a project-start mark, or the beginning of a work period when `end` is also present. |
| `end` | One date | Creates a project-end mark, or the end of a work period when `start` is also present. |
| `tags` | Comma-separated text | Helps local categorization and card labels. Keep the list short and factual. |
| `source` | URL or local identifier | A verified HTTP(S) source URL becomes the item's **View original** destination. If unavailable, omit it rather than inventing a link. |
| `apply` | URL | Stored as application metadata. The current detail interface does not display a separate application-link list. |

Metadata keys are case-insensitive, but using the lowercase names above makes exports easier to review.

## Dates and timeline behavior

Use complete dates with a four-digit year. The parser accepts `-`, `/`, or `.` separators, but ISO `YYYY-MM-DD` is the safest and most readable form.

| Markdown input | Result in Timeline |
|---|---|
| `date: 2026-07-17` | Published point on 17 July 2026 |
| `deadline: 2026-08-20` | Application deadline point |
| `event: 2026-08-26` | Single event point |
| `event: 2026-08-26 to 2026-08-28` | Event range |
| `start: 2026-09-01` | Project-start point |
| `end: 2026-12-15` | Project-end point |
| Both `start` and `end` | Work-period range |

For ranges, the parser accepts `to`, `-`, `至`, `到`, `～`, or `~` between two complete dates. Do not use relative phrases such as "next Friday" or incomplete dates such as "August 20"; OpenClaw should resolve them from the email context.

If a deadline is rolling or not stated, omit `deadline` and describe it accurately in the summary or body. Do not invent a date.

## Complete example

```markdown
# CUHK MailRoute Mail Export
<!-- cu-link-export: v1 -->

## Item: Student Helper for Orientation Events — HK$70/hour
- id: cuhk-message-100001
- date: 2026-07-17
- from: Office of Student Affairs
- email: studentaffairs@cuhk.edu.hk
- deadline: 2026-08-20
- event: 2026-08-26 to 2026-08-28
- start: 2026-08-26
- end: 2026-08-28
- tags: paid_work, student helper, orientation
- source: https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260717/100001
- apply: https://cloud.itsc.cuhk.edu.hk/example-form

### Summary
The Office of Student Affairs is recruiting student helpers for on-site orientation support at HK$70 per hour. Applications close on 20 August 2026.

### Body
Student helpers are required to support registration and venue logistics during orientation events from 26 to 28 August 2026.

Hourly rate: HK$70.
Application deadline: 20 August 2026.
Applicants must be current CUHK students and available for all assigned shifts.

## Item: NLP Research Assistant — Rolling Applications
- id: engineering-nlp-ra-2026-09
- date: 2026-07-17
- from: Faculty of Engineering
- email: nlp-project@cuhk.edu.hk
- start: 2026-09-01
- end: 2026-12-15
- tags: research, research assistant, NLP

### Summary
The project is recruiting a part-time research assistant for NLP data preparation. Applications are reviewed on a rolling basis until the position is filled.

### Body
The assistant will support dataset preparation and basic evaluation for an NLP research project from September to December 2026. Python experience is preferred. Applications are reviewed on a rolling basis.
```

The second item intentionally has no `source` or `deadline`: missing authoritative information is better than an invented URL or date.

## Import behavior

When CUHK MailRoute parses a valid file, it:

- removes repeated decorative emoji and cleans obvious text noise;
- keeps at most 30,000 body characters per item and a 20,000-character cleaned copy;
- infers a broad opportunity type from the title, body, and tags;
- creates timeline marks from explicit date fields;
- generates a local ID when `id` is missing;
- treats imported items as local browser data;
- merges by item ID, replacing an earlier imported item when the same ID is imported again.

Imported items do not modify `public/data/feed.json`. Clearing imported mail removes the imported collection from the current browser only.

## Troubleshooting

### “Not a CUHK MailRoute mail export”

Add this marker near the top:

```markdown
<!-- cu-link-export: v1 -->
```

Alternatively, confirm that the file contains at least one heading written exactly as `## Item: Title`.

### “No Item blocks found”

The parser did not find any `## Item:` headings. Do not use `# Item`, `### Item`, a table row, or a bullet as the item boundary.

### Dates do not appear in Timeline

- Use complete dates such as `2026-08-20`.
- Put the value on a line beginning with `- deadline:`, `- event:`, `- start:`, or `- end:`.
- Include two complete dates for a range.

### The original-message link is missing

The `source` field must contain a usable HTTP(S) address. Prefer the exact CUHK Digest message URL. Placeholder, malformed, and local-only addresses are intentionally not shown as authoritative links.

### Duplicate items appear

Give every message a stable `id`. Reusing it lets CUHK MailRoute replace the earlier imported version instead of adding another item.

### A summary repeats the title

Ask OpenClaw for one or two factual sentences that add organizer, work, compensation, deadline, audience, or participation details not already present in the title. CUHK MailRoute may suppress substantially redundant summaries.

### Merge succeeds but AI polish does not

Markdown import does not use AI. For polish, enable AI Services in **Settings**, configure the selected provider, test the connection, save, and then run **Polish this page** from **For you**.

## Final checklist

Before importing, confirm that:

- [ ] The file contains `<!-- cu-link-export: v1 -->`.
- [ ] Every opportunity begins with `## Item:`.
- [ ] Titles are factual and free of decorative emoji runs.
- [ ] Dates use `YYYY-MM-DD`.
- [ ] Amounts, deadlines, eligibility, and organizers match the email.
- [ ] Each `source` is a real authoritative URL, not a placeholder.
- [ ] Unknown values are omitted rather than guessed.
- [ ] Stable IDs are present when available.
- [ ] Private reply chains, tokens, and unrelated correspondence are removed.
- [ ] Example items have been deleted.
- [ ] The CUHK MailRoute preview is correct before selecting **Merge**.
