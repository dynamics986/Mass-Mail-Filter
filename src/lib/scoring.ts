import type {
  Eligibility,
  Evaluation,
  GoalType,
  L1Type,
  L2Domain,
  MailItem,
  Profile,
  Requirement,
  ScoreBreakdown,
  ScoreReason,
  YearLevel,
} from "../types";

const FACULTY_DOMAIN: Record<string, L2Domain[]> = {
  arts: ["Arts", "Language"],
  business: ["Business"],
  education: ["Education"],
  engineering: ["Engineering", "CS_AI"],
  law: ["Law"],
  medicine: ["Medicine"],
  science: ["Science", "CS_AI"],
  "social-science": ["SocialScience"],
};

const ADJACENT: Record<L2Domain, L2Domain[]> = {
  Engineering: ["CS_AI", "Science"],
  CS_AI: ["Engineering", "Science"],
  Business: ["SocialScience", "Law"],
  Medicine: ["Science"],
  Arts: ["Language", "Education"],
  Education: ["Arts", "SocialScience"],
  Science: ["Engineering", "CS_AI", "Medicine"],
  SocialScience: ["Business", "Arts", "Education"],
  Law: ["Business", "SocialScience"],
  Language: ["Arts", "Education"],
  Cross: [],
};

const GOAL_L1: Record<GoalType, L1Type[]> = {
  paid: ["paid_work"],
  research: ["research"],
  competition: ["competition"],
  volunteer: ["service"],
  event: ["event", "programme"],
};

const L1_MEANINGFUL: Record<L1Type, number> = {
  research: 78,
  paid_work: 72,
  programme: 70,
  competition: 68,
  service: 55,
  event: 48,
  admin: 22,
};

const normalize = (s: string) => s.toLowerCase();

function profileValue(profile: Profile, field: Requirement["field"]): string | number | string[] | undefined {
  if (field === "studentLevel") return profile.studentLevel;
  if (field === "major") return profile.major || profile.programmeId;
  if (field === "nativeLanguage") return profile.nativeLanguages;
  if (field === "spokenLanguage") return profile.spokenLanguages;
  if (field === "age") return profile.age;
  if (field === "gender") return profile.gender;
  if (field === "residency") return profile.residency;
  if (field === "health") return profile.health;
  return profile.skills;
}

export function checkRequirement(req: Requirement, profile: Profile): "match" | "conflict" | "unknown" {
  const actual = profileValue(profile, req.field);
  if (actual === undefined || actual === "" || (Array.isArray(actual) && actual.length === 0)) return "unknown";
  if (req.field === "age" && typeof actual === "number" && typeof req.value === "number") {
    if (req.operator === "min") return actual >= req.value ? "match" : "conflict";
    if (req.operator === "max") return actual <= req.value ? "match" : "conflict";
  }
  const wanted = normalize(String(req.value));
  const values = Array.isArray(actual) ? actual.map(x => normalize(String(x))) : [normalize(String(actual))];
  return values.some(v => (req.operator === "includes" ? v.includes(wanted) || wanted.includes(v) : v === wanted))
    ? "match"
    : "conflict";
}

export function evaluateEligibility(item: MailItem, profile: Profile): { eligibility: Eligibility; evidence: string[] } {
  if (!item.requirements.length) return { eligibility: "unknown", evidence: [] };
  const checks = item.requirements.map(req => ({ req, result: checkRequirement(req, profile) }));
  const evidence = checks.map(c => `${c.result}: ${c.req.evidence}`);
  if (checks.some(c => c.result === "conflict" && c.req.confidence === "high")) {
    return { eligibility: "ineligible", evidence };
  }
  if (checks.some(c => c.result === "unknown")) {
    return { eligibility: checks.some(c => c.result === "match") ? "likely" : "unknown", evidence };
  }
  return { eligibility: "eligible", evidence };
}

export function listRequirementChecks(
  item: MailItem,
  profile: Profile,
): Array<{ req: Requirement; result: "match" | "conflict" | "unknown" }> {
  return item.requirements.map(req => ({ req, result: checkRequirement(req, profile) }));
}

const REQ_FIELD_LABEL: Record<Requirement["field"], { zh: string; en: string }> = {
  studentLevel: { zh: "学生阶段", en: "Level" },
  major: { zh: "专业", en: "Major" },
  nativeLanguage: { zh: "母语", en: "Native" },
  spokenLanguage: { zh: "语言", en: "Spoken" },
  age: { zh: "年龄", en: "Age" },
  gender: { zh: "性别", en: "Gender" },
  residency: { zh: "身份", en: "Residency" },
  health: { zh: "健康", en: "Health" },
  skill: { zh: "技能", en: "Skill" },
};

export function formatRequirementLabel(req: Requirement, lang: "zh" | "en"): string {
  const field = REQ_FIELD_LABEL[req.field][lang];
  const short = String(req.value).slice(0, 28);
  if (req.operator === "min") return `${field}≥${short}`;
  if (req.operator === "max") return `${field}≤${short}`;
  return `${field}: ${short}`;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function daysUntil(deadline: string): number {
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function scoreUrgent(item: MailItem, reasons: ScoreReason[]): number {
  if (item.deadlineKind === "rolling") {
    reasons.push({ key: "rolling", dimension: "urgent", points: 40, label: "Rolling recruitment" });
    return 40;
  }
  if (item.deadlineKind !== "apply" || !item.deadline) {
    reasons.push({ key: "no-deadline", dimension: "urgent", points: 28, label: "No application deadline stated" });
    return 28;
  }
  const days = daysUntil(item.deadline);
  let score = 18;
  let label = `Deadline in ${days} days`;
  if (days < 0) {
    score = 0;
    label = "Deadline passed";
  } else if (days <= 1) score = 100;
  else if (days <= 3) score = 90;
  else if (days <= 7) score = 75;
  else if (days <= 14) score = 55;
  else if (days <= 30) score = 35;
  reasons.push({ key: "deadline", dimension: "urgent", points: score, label });
  return score;
}

function scoreFit(item: MailItem, profile: Profile, eligibility: Eligibility, reasons: ScoreReason[]): number {
  if (eligibility === "ineligible") {
    reasons.push({ key: "ineligible", dimension: "fit", points: 0, label: "Hard eligibility conflict" });
    return 0;
  }
  let score = eligibility === "eligible" ? 75 : eligibility === "likely" ? 58 : 42;
  reasons.push({ key: "eligibility-base", dimension: "fit", points: score, label: `Eligibility: ${eligibility}` });

  const domains = item.taxonomy?.domains ?? [];
  const mine = FACULTY_DOMAIN[profile.facultyId] ?? [];
  if (mine.some(d => domains.includes(d))) {
    score += 18;
    reasons.push({ key: "faculty-domain", dimension: "fit", points: 18, label: "Matches your faculty domain" });
  } else if (mine.some(d => domains.some(x => ADJACENT[d]?.includes(x)))) {
    score += 10;
    reasons.push({ key: "adjacent-domain", dimension: "fit", points: 10, label: "Related academic domain" });
  }

  const langReqs = item.requirements.filter(r => r.field === "nativeLanguage" || r.field === "spokenLanguage");
  if (langReqs.some(r => checkRequirement(r, profile) === "match")) {
    score += 12;
    reasons.push({ key: "language-match", dimension: "fit", points: 12, label: "Language requirement matches" });
  } else if (langReqs.some(r => checkRequirement(r, profile) === "conflict")) {
    score = Math.min(score, 25);
    reasons.push({ key: "language-conflict", dimension: "fit", points: -20, label: "Language requirement conflict" });
  }

  const goalHits = profile.goals.filter(g => GOAL_L1[g]?.includes(item.taxonomy?.type));
  if (goalHits.length) {
    const bonus = Math.min(20, goalHits.length * 8);
    score += bonus;
    reasons.push({ key: "goals", dimension: "fit", points: bonus, label: `Matches goals: ${goalHits.join(", ")}` });
  }

  const blob = normalize(`${item.title} ${item.summary} ${item.tags.join(" ")}`);
  const skillHits = profile.skills.filter(s => s && blob.includes(normalize(s)));
  if (skillHits.length) {
    const bonus = Math.min(10, skillHits.length * 4);
    score += bonus;
    reasons.push({ key: "skills", dimension: "fit", points: bonus, label: `Skill overlap: ${skillHits.slice(0, 3).join(", ")}` });
  }

  return clamp(score);
}

function scoreValue(item: MailItem, profile: Profile, reasons: ScoreReason[]): number {
  let score = 35;
  const comp = item.compensation;
  if (comp) {
    const amount = comp.maxHkd ?? comp.minHkd ?? 0;
    if (comp.type === "cash" || comp.type === "allowance") {
      score = amount >= 200 ? 90 : amount >= 64 ? 78 : amount > 0 ? 65 : 55;
    } else if (comp.type === "voucher") score = 48;
    else if (comp.type === "prize") score = 42;
    else score = 50;
    reasons.push({ key: "compensation", dimension: "value", points: score, label: "Has compensation" });
    if (profile.preferPaid) score = clamp(score + 8);
  } else if (item.taxonomy?.roles?.includes("ra") || item.taxonomy?.roles?.includes("intern")) {
    score = 50;
    reasons.push({ key: "experience-value", dimension: "value", points: 50, label: "Experience / CV value" });
    if (profile.preferPaid) score = clamp(score - 8);
  } else if (profile.preferPaid && item.taxonomy?.type === "service") {
    score = 28;
    reasons.push({ key: "unpaid-service", dimension: "value", points: 28, label: "Unpaid service (prefer paid)" });
  }

  const text = normalize(`${item.title} ${item.summary} ${item.cleanBody ?? item.bodyText}`);
  if (/(certificate|学分|學分|推薦信|recommendation letter|credit)/i.test(text)) {
    score = clamp(score + 12);
    reasons.push({ key: "credential", dimension: "value", points: 12, label: "Credential / credit signal" });
  }
  return clamp(score);
}

function scoreMeaningful(item: MailItem, profile: Profile, reasons: ScoreReason[]): number {
  const type = item.taxonomy?.type ?? "admin";
  let score = L1_MEANINGFUL[type] ?? 40;
  reasons.push({ key: "type-prior", dimension: "meaningful", points: score, label: `Type prior: ${type}` });

  const text = normalize(`${item.title} ${item.summary}`);
  const subject =
    /looking for participants|call for participants|招募參與|招募参与|clinical trial|human subjects/.test(text);
  if (subject) {
    if (profile.goals.includes("research") && !profile.excluded.some(x => /recruit|受试|參與者|参与者/i.test(x))) {
      score = clamp(score - 5);
      reasons.push({ key: "subject-ok", dimension: "meaningful", points: -5, label: "Subject recruitment (research goal)" });
    } else {
      score = 25;
      reasons.push({ key: "subject-low", dimension: "meaningful", points: 25, label: "Subject recruitment (lower meaning)" });
    }
  }

  if (/(portfolio|research experience|hands-on|可寫進|履历|履歷|cv)/i.test(text)) {
    score = clamp(score + 10);
    reasons.push({ key: "growth", dimension: "meaningful", points: 10, label: "Growth / portfolio signal" });
  }
  if (type === "admin") score = Math.min(score, 30);
  return clamp(score);
}

function scoreImportant(item: MailItem, profile: Profile, reasons: ScoreReason[]): number {
  const year = profile.year as YearLevel;
  if (!year) {
    reasons.push({ key: "year-missing", dimension: "important", points: 50, label: "Year not set — neutral importance" });
    return 50;
  }
  const type = item.taxonomy?.type ?? "admin";
  let score = 50;
  const early = year === "Y1" || year === "Y2";
  const late = year === "Y3" || year === "Y4" || year === "Y5" || year === "Final";
  if (early && (type === "event" || type === "programme" || type === "service")) score = 70;
  if (late && (type === "paid_work" || type === "research" || type === "competition")) score = 82;
  if (year === "PG" && type === "research") score = 88;
  if (type === "admin") score = 30;
  reasons.push({ key: "year-type", dimension: "important", points: score, label: `Year ${year} × ${type}` });
  return clamp(score);
}

export function evaluateItem(item: MailItem, profile: Profile): Evaluation {
  const { eligibility, evidence } = evaluateEligibility(item, profile);
  const reasons: ScoreReason[] = [];
  const scores: ScoreBreakdown = {
    fit: scoreFit(item, profile, eligibility, reasons),
    urgent: scoreUrgent(item, reasons),
    value: scoreValue(item, profile, reasons),
    meaningful: scoreMeaningful(item, profile, reasons),
    important: scoreImportant(item, profile, reasons),
    total: 0,
  };
  const w = profile.weights;
  const weightSum = w.fit + w.urgent + w.value + w.meaningful + w.important || 1;
  scores.total = clamp(
    (scores.fit * w.fit +
      scores.urgent * w.urgent +
      scores.value * w.value +
      scores.meaningful * w.meaningful +
      scores.important * w.important) /
      weightSum,
  );
  return { eligibility, evidence, reasons, scores, score: scores.total };
}

export function isClosingSoon(item: MailItem): boolean {
  if (item.deadlineKind !== "apply" || !item.deadline) return false;
  const days = daysUntil(item.deadline);
  return days >= 0 && days <= 7;
}

export function isExcluded(item: MailItem, profile: Profile): boolean {
  const blob = normalize(`${item.title} ${item.summary} ${item.bodyText}`);
  return profile.excluded.some(x => x && blob.includes(normalize(x)));
}

export function relativeDeadline(item: MailItem, lang: "zh" | "en"): string {
  if (item.deadlineKind === "rolling") return lang === "zh" ? "滚动招募" : "Rolling";
  if (!item.deadline) return lang === "zh" ? "未注明截止" : "No deadline";
  const days = daysUntil(item.deadline);
  if (days < 0) return lang === "zh" ? "已截止" : "Closed";
  if (days === 0) return lang === "zh" ? "今天截止" : "Due today";
  if (days === 1) return lang === "zh" ? "还有 1 天" : "1 day left";
  if (days <= 30) return lang === "zh" ? `还有 ${days} 天` : `${days} days left`;
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", { dateStyle: "medium" }).format(new Date(item.deadline));
}
