# OpenClaw → CU Link Markdown bridge

CU Link can ingest a mailbox dump as Markdown. OpenClaw (or any agent) reads mail, writes this format, and the web app imports it locally—no API keys, no server upload.

## Workflow

1. Ask OpenClaw to scan the target mailbox / Mass Mail folder.
2. Have it emit a file matching `public/templates/cu-link-mail-export.example.md`.
3. In CU Link, open **Import**, paste or upload the `.md`, then **Merge**.
4. Items appear in Home / Timeline with `source: import`. They stay in `localStorage` until cleared.

## Required shape

```markdown
# CU Link Mail Export
<!-- cu-link-export: v1 -->

## Item: <title>
- date: YYYY-MM-DD          # publish / received
- deadline: YYYY-MM-DD      # application deadline (optional)
- event: YYYY-MM-DD to YYYY-MM-DD   # point or range (optional)
- start: YYYY-MM-DD         # project / work start (optional)
- end: YYYY-MM-DD           # project / work end (optional)
- from: <organizer>
- email: <contact>
- tags: a, b
- source: <url or local id>
- apply: <application url>

### Summary
<short extractive summary>

### Body
<full plain text>
```

## Field mapping → timeline

| Markdown field | Timeline mark |
|---|---|
| `date` | published (point) |
| `deadline` | apply_deadline (point) |
| `event` single | event_point |
| `event` range | event_range |
| `start` + `end` | work_period (range) |
| `start` only | project_start |
| `end` only | project_end |

## Privacy

Import runs entirely in the browser. The markdown may contain personal mailbox content—treat the file as private and do not commit it to git.
