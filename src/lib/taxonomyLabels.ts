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

const TAG_LABELS: Record<string, { zh: string; en: string }> = {
  applicant: { zh: "招募对象", en: "Applicant" },
  attendee: { zh: "参与者", en: "Attendee" },
  helper: { zh: "活动助理", en: "Helper" },
  intern: { zh: "实习", en: "Internship" },
  ra: { zh: "研究助理", en: "Research assistant" },
  volunteer: { zh: "志愿者", en: "Volunteer" },
  notice: { zh: "通知", en: "Notice" },
  research: { zh: "研究", en: "Research" },
  medicine: { zh: "医学", en: "Medicine" },
  education: { zh: "教育", en: "Education" },
  language: { zh: "语言", en: "Language" },
  cross: { zh: "跨领域", en: "Cross-disciplinary" },
  socialscience: { zh: "社会科学", en: "Social science" },
  arts: { zh: "人文艺术", en: "Arts" },
  "paid work": { zh: "有薪工作", en: "Paid work" },
  cs_ai: { zh: "计算机与人工智能", en: "Computing & AI" },
  event: { zh: "活动", en: "Event" },
  programme: { zh: "课程项目", en: "Programme" },
  business: { zh: "商科", en: "Business" },
  engineering: { zh: "工程", en: "Engineering" },
  science: { zh: "理科", en: "Science" },
  competition: { zh: "竞赛", en: "Competition" },
  service: { zh: "服务", en: "Service" },
};

export function tagLabel(tag: string, lang: "zh" | "en"): string {
  return TAG_LABELS[tag.trim().toLowerCase()]?.[lang] ?? tag;
}
