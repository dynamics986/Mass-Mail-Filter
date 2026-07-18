import type { MailItem, TimeKind, TimeMark } from "../types";

const KIND_LABEL: Record<TimeKind, { zh: string; en: string }> = {
  published: { zh: "发布", en: "Published" },
  apply_deadline: { zh: "申请截止", en: "Apply by" },
  event_point: { zh: "活动日", en: "Event" },
  event_range: { zh: "活动时段", en: "Event period" },
  project_start: { zh: "开始", en: "Starts" },
  project_end: { zh: "结束", en: "Ends" },
  work_period: { zh: "工作期", en: "Work period" },
  rolling: { zh: "滚动招募", en: "Rolling" },
};

export function kindLabel(kind: TimeKind, lang: "zh" | "en"): string {
  return KIND_LABEL[kind][lang];
}

/** Ensure every item has usable timeMarks (synthesize if scraper field missing). */
export function ensureTimeMarks(item: MailItem): TimeMark[] {
  if (item.timeMarks?.length) return item.timeMarks;
  const marks: TimeMark[] = [];
  const pub = (item.publishedAt || item.digestDate || "").slice(0, 10);
  if (pub) {
    marks.push({
      kind: "published",
      shape: "point",
      start: pub,
      confidence: "high",
      evidence: "digest / published date",
      label: "Published",
    });
  }
  if (item.deadlineKind === "rolling") {
    marks.push({
      kind: "rolling",
      shape: "open",
      confidence: item.deadlineConfidence || "medium",
      evidence: item.deadlineEvidence || "rolling",
      label: "Rolling",
    });
  } else if (item.deadline) {
    marks.push({
      kind: "apply_deadline",
      shape: "point",
      start: item.deadline,
      confidence: item.deadlineConfidence || "medium",
      evidence: item.deadlineEvidence || "",
      label: "Apply by",
    });
  }
  return marks;
}

export interface TimelineEntry {
  id: string;
  itemId: string;
  title: string;
  summary: string;
  mark: TimeMark;
  sortKey: string;
}

export function buildTimeline(items: MailItem[], kinds?: Set<TimeKind> | null): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const item of items) {
    for (const mark of ensureTimeMarks(item)) {
      if (kinds && kinds.size && !kinds.has(mark.kind)) continue;
      const sortKey =
        mark.shape === "open" ? `9999-${mark.kind}` : `${mark.start || "9999"}-${mark.end || ""}-${mark.kind}`;
      entries.push({
        id: `${item.id}:${mark.kind}:${mark.start || "open"}:${mark.end || ""}`,
        itemId: item.id,
        title: item.title,
        summary: item.summary,
        mark,
        sortKey,
      });
    }
  }
  return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function formatMarkSpan(mark: TimeMark, lang: "zh" | "en"): string {
  const fmt = (d?: string) =>
    d
      ? new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", { dateStyle: "medium" }).format(new Date(d))
      : "—";
  if (mark.shape === "open") return lang === "zh" ? "开放 / 滚动" : "Open / rolling";
  if (mark.shape === "range" && mark.start && mark.end) return `${fmt(mark.start)} → ${fmt(mark.end)}`;
  return fmt(mark.start);
}

const ACTION_KINDS: TimeKind[] = ["apply_deadline", "event_point", "event_range", "project_start", "project_end"];

/** Closing soon, or an apply/event mark falling within the next `withinDays` days. */
export function isActionThisWeek(item: MailItem, withinDays = 7): boolean {
  if (item.deadlineKind === "apply" && item.deadline) {
    const days = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000);
    if (days >= 0 && days <= withinDays) return true;
  }
  const now = Date.now();
  const end = now + withinDays * 86400000;
  for (const mark of ensureTimeMarks(item)) {
    if (!ACTION_KINDS.includes(mark.kind)) continue;
    const start = mark.start ? new Date(mark.start).getTime() : NaN;
    const finish = mark.end ? new Date(mark.end).getTime() : start;
    if (!Number.isFinite(start)) continue;
    if (start <= end && finish >= now) return true;
  }
  return false;
}

export function nearestActionSortKey(item: MailItem): string {
  let best = "9999-99-99";
  for (const mark of ensureTimeMarks(item)) {
    if (!ACTION_KINDS.includes(mark.kind) || !mark.start) continue;
    if (mark.start < best) best = mark.start;
  }
  if (item.deadline && item.deadline < best) best = item.deadline;
  return best;
}
