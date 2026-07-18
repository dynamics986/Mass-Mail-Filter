import type { MailItem, TimeMark, Taxonomy } from "../types";

/**
 * OpenClaw / mailbox export format (cu-link-export v1)
 *
 * # CU Link Mail Export
 * <!-- cu-link-export: v1 -->
 *
 * ## Item: Title of the opportunity
 * - id: optional-stable-id
 * - date: 2026-07-17
 * - from: Organizer Name
 * - email: someone@cuhk.edu.hk
 * - deadline: 2026-08-10
 * - event: 2026-08-26 to 2026-08-28
 * - start: 2026-09-01
 * - end: 2026-12-15
 * - tags: research, helper
 * - source: https://example.com/message
 * - apply: https://example.com/form
 *
 * ### Summary
 * One or two sentence extractive summary.
 *
 * ### Body
 * Full plain-text body…
 */

const defaultTaxonomy = (): Taxonomy => ({
  type: "admin",
  domains: ["Cross"],
  roles: ["applicant"],
  confidence: "low",
  evidence: "imported",
});

function slugId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `import-${base || "item"}-${index + 1}`;
}

function metaValue(block: string, key: string): string | undefined {
  const re = new RegExp(`^\\s*[-*]\\s*${key}\\s*:\\s*(.+)$`, "im");
  const m = block.match(re);
  return m?.[1]?.trim();
}

function section(block: string, name: string): string {
  const re = new RegExp(`###\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, "i");
  const m = block.match(re);
  return (m?.[1] || "").trim();
}

function parseRange(value: string): { start?: string; end?: string } {
  const m = value.match(
    /(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\s*(?:to|–|—|-|至|到|～|~)\s*(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})/i,
  );
  if (!m) {
    const single = value.match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/);
    return single ? { start: single[0].replace(/[/.]/g, "-") } : {};
  }
  return { start: m[1].replace(/[/.]/g, "-"), end: m[2].replace(/[/.]/g, "-") };
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const iso = value.match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/);
  if (!iso) return undefined;
  const [y, m, d] = iso[0].replace(/[/.]/g, "-").split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function guessTaxonomy(title: string, body: string, tags: string[]): Taxonomy {
  const blob = `${title} ${body} ${tags.join(" ")}`.toLowerCase();
  let type: Taxonomy["type"] = "admin";
  if (/student helper|兼職|兼职|intern|hk\$|hourly/.test(blob)) type = "paid_work";
  else if (/research assistant|experiment|招募參與|participant/.test(blob)) type = "research";
  else if (/hackathon|competition|比賽|竞赛/.test(blob)) type = "competition";
  else if (/volunteer|義工|义工/.test(blob)) type = "service";
  else if (/seminar|talk|講座|讲座|workshop/.test(blob)) type = "event";
  else if (/programme|program|訓練|训练|certificate/.test(blob)) type = "programme";
  return { ...defaultTaxonomy(), type, evidence: "markdown import heuristic" };
}

function buildTimeMarks(fields: {
  date?: string;
  deadline?: string;
  event?: string;
  start?: string;
  end?: string;
}): TimeMark[] {
  const marks: TimeMark[] = [];
  const pub = normalizeDate(fields.date);
  if (pub) {
    marks.push({
      kind: "published",
      shape: "point",
      start: pub,
      confidence: "high",
      evidence: "markdown date",
      label: "Published",
    });
  }
  const deadline = normalizeDate(fields.deadline);
  if (deadline) {
    marks.push({
      kind: "apply_deadline",
      shape: "point",
      start: deadline,
      confidence: "high",
      evidence: "markdown deadline",
      label: "Apply by",
    });
  }
  if (fields.event) {
    const range = parseRange(fields.event);
    if (range.start && range.end) {
      marks.push({
        kind: "event_range",
        shape: "range",
        start: normalizeDate(range.start),
        end: normalizeDate(range.end),
        confidence: "high",
        evidence: "markdown event",
        label: "Event period",
      });
    } else if (range.start) {
      marks.push({
        kind: "event_point",
        shape: "point",
        start: normalizeDate(range.start),
        confidence: "high",
        evidence: "markdown event",
        label: "Event",
      });
    }
  }
  const start = normalizeDate(fields.start);
  const end = normalizeDate(fields.end);
  if (start && end) {
    marks.push({
      kind: "work_period",
      shape: "range",
      start,
      end,
      confidence: "high",
      evidence: "markdown start/end",
      label: "Work period",
    });
  } else {
    if (start) {
      marks.push({
        kind: "project_start",
        shape: "point",
        start,
        confidence: "high",
        evidence: "markdown start",
        label: "Starts",
      });
    }
    if (end) {
      marks.push({
        kind: "project_end",
        shape: "point",
        start: end,
        confidence: "high",
        evidence: "markdown end",
        label: "Ends",
      });
    }
  }
  return marks;
}

export function parseCuLinkMarkdown(markdown: string): MailItem[] {
  const text = markdown.replace(/^\uFEFF/, "");
  if (!/cu-link-export/i.test(text) && !/^##\s+Item\s*:/m.test(text)) {
    throw new Error("Not a CU Link mail export. Expect <!-- cu-link-export: v1 --> or ## Item: headings.");
  }
  const parts = text.split(/^##\s+Item\s*:\s*/im).slice(1);
  if (!parts.length) throw new Error("No ## Item: blocks found in the markdown.");

  const now = new Date().toISOString();
  return parts.map((part, index) => {
    const titleLineEnd = part.indexOf("\n");
    const title = (titleLineEnd >= 0 ? part.slice(0, titleLineEnd) : part).trim();
    const rest = titleLineEnd >= 0 ? part.slice(titleLineEnd + 1) : "";
    const id = metaValue(rest, "id") || slugId(title, index);
    const date = normalizeDate(metaValue(rest, "date")) || now.slice(0, 10);
    const from = metaValue(rest, "from");
    const email = metaValue(rest, "email");
    const deadline = normalizeDate(metaValue(rest, "deadline"));
    const event = metaValue(rest, "event");
    const start = metaValue(rest, "start");
    const end = metaValue(rest, "end");
    const source = metaValue(rest, "source") || `local://import/${id}`;
    const apply = metaValue(rest, "apply");
    const tags = (metaValue(rest, "tags") || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    const summary = section(rest, "Summary");
    const body = section(rest, "Body") || rest.replace(/^[-*].*$/gm, "").trim();
    const timeMarks = buildTimeMarks({ date, deadline, event, start, end });
    const taxonomy = guessTaxonomy(title, body, tags);

    return {
      id,
      digestDate: date,
      category: "Imported",
      title,
      bodyText: body.slice(0, 30000),
      cleanBody: body.slice(0, 20000),
      summary: summary || body.split(/\n+/).find(l => l.trim().length > 20)?.slice(0, 280) || title,
      summaryEvidence: summary ? [summary] : [],
      organizer: from,
      contactEmail: email,
      sourceUrl: source,
      applicationUrls: apply ? [apply] : [],
      deadline,
      deadlineKind: deadline ? "apply" : "unknown",
      deadlineConfidence: deadline ? "high" : "low",
      deadlineEvidence: deadline ? "markdown deadline" : "",
      timeMarks,
      taxonomy,
      tags: tags.length ? tags : [taxonomy.type],
      keyPhrases: [],
      requirements: [],
      publishedAt: `${date}T00:00:00+08:00`,
      fetchedAt: now,
      source: "import" as const,
    };
  });
}

export const EXPORT_TEMPLATE = `# CU Link Mail Export
<!-- cu-link-export: v1 -->
<!-- OpenClaw: dump mailbox messages into Item blocks below, then import in CU Link → Import -->

## Item: Example — Student Helper Recruitment (HK$64/hr)
- id: example-helper-1
- date: 2026-07-17
- from: Centre for Learning Enhancement And Research
- email: example@cuhk.edu.hk
- deadline: 2026-08-20
- event: 2026-08-26 to 2026-08-28
- start: 2026-08-26
- end: 2026-08-28
- tags: paid_work, helper
- source: https://example.com/message/1
- apply: https://example.com/apply/1

### Summary
Recruiting student helpers at HK$64/hr for on-site event logistics.

### Body
The Centre is recruiting student helpers to provide logistical support for on-site events.
Hourly Rate: HK$64
Application deadline: 2026-08-20
Event dates: 26-28 August 2026

## Item: Example — Research Assistant (rolling)
- date: 2026-07-17
- from: Faculty of Engineering
- deadline:
- start: 2026-09-01
- end: 2026-12-15
- tags: research, ra
- source: https://example.com/message/2

### Summary
Part-time research assistant for an NLP project; applications reviewed on a rolling basis.

### Body
Research Assistant wanted. Applications are reviewed on a rolling basis until the position is filled.
Employment period: 2026-09-01 to 2026-12-15.
`;
