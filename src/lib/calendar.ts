import type { TimelineEntry } from "./schedule";

export interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
  points: TimelineEntry[];
  ranges: TimelineEntry[];
}

export function monthLabel(year: number, month: number, lang: "zh" | "en"): string {
  const d = new Date(Date.UTC(year, month, 1));
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIso(iso?: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Build a 6×7 month grid; ranges attach to every day they cover. */
export function buildMonthGrid(year: number, month: number, entries: TimelineEntry[]): CalendarDay[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7; // Monday-first
  const gridStart = new Date(Date.UTC(year, month, 1 - startOffset));
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i++) {
    const cell = new Date(gridStart.getTime() + i * 86400000);
    const y = cell.getUTCFullYear();
    const m = cell.getUTCMonth();
    const d = cell.getUTCDate();
    const iso = toIso(y, m, d);
    const points: TimelineEntry[] = [];
    const ranges: TimelineEntry[] = [];
    for (const entry of entries) {
      if (entry.mark.shape === "open") continue;
      if (entry.mark.shape === "range" && entry.mark.start && entry.mark.end) {
        const a = parseIso(entry.mark.start);
        const b = parseIso(entry.mark.end);
        const cur = parseIso(iso);
        if (a && b && cur && cur >= a && cur <= b) ranges.push(entry);
      } else if (entry.mark.start === iso) {
        points.push(entry);
      }
    }
    days.push({ iso, day: d, inMonth: m === month, points, ranges });
  }
  return days;
}

export function weekdayHeaders(lang: "zh" | "en"): string[] {
  return lang === "zh"
    ? ["一", "二", "三", "四", "五", "六", "日"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}
