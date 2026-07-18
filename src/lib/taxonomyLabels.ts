import type { L1Type } from "../types";

export function taxonomyLabel(type: L1Type | string | undefined, lang: "zh" | "en"): string {
  const map: Record<string, { zh: string; en: string }> = {
    paid_work: { zh: "有薪工作", en: "Paid work" },
    research: { zh: "研究", en: "Research" },
    event: { zh: "活动", en: "Event" },
    programme: { zh: "课程项目", en: "Programme" },
    competition: { zh: "竞赛", en: "Competition" },
    service: { zh: "志愿", en: "Volunteer" },
    admin: { zh: "行政通知", en: "Admin" },
  };
  if (!type) return lang === "zh" ? "其他" : "Other";
  return map[type]?.[lang] ?? String(type).replace("_", " ");
}
