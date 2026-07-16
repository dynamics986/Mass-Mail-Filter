import type { Eligibility, Evaluation, MailItem, Profile, Requirement } from "../types";

const engineeringWords = ["engineering", "software", "developer", "programming", "python", "web development", "artificial intelligence", " ai ", "data analysis", "robot", "computer", "工程", "软件", "軟件", "程式", "编程", "編程", "人工智能", "数据", "數據", "機器人"];
const helperWords = ["student helper", "research assistant", "part-time", "part time", "學生助理", "学生助理", "研究助理", "兼職", "兼职"];
const paidWords = ["hkd", "hk$", "$", "cash", "coupon", "voucher", "allowance", "stipend", "reward", "paid", "酬劳", "酬勞", "津贴", "津貼", "现金", "現金", "礼券", "禮券"];
const normalize = (s: string) => s.toLowerCase();
const includesAny = (text: string, words: string[]) => words.some(w => text.includes(w));
const profileValue = (profile: Profile, field: Requirement["field"]): string | number | string[] | undefined => {
  if (field === "studentLevel") return profile.studentLevel;
  if (field === "major") return profile.major;
  if (field === "nativeLanguage") return profile.nativeLanguages;
  if (field === "spokenLanguage") return profile.spokenLanguages;
  if (field === "age") return profile.age;
  if (field === "gender") return profile.gender;
  if (field === "residency") return profile.residency;
  if (field === "health") return profile.health;
  return profile.skills;
};
function checkRequirement(req: Requirement, profile: Profile): "match" | "conflict" | "unknown" {
  const actual = profileValue(profile, req.field);
  if (actual === undefined || actual === "" || (Array.isArray(actual) && actual.length === 0)) return "unknown";
  if (req.field === "age" && typeof actual === "number" && typeof req.value === "number") {
    if (req.operator === "min") return actual >= req.value ? "match" : "conflict";
    if (req.operator === "max") return actual <= req.value ? "match" : "conflict";
  }
  const wanted = normalize(String(req.value));
  const values = Array.isArray(actual) ? actual.map(x => normalize(String(x))) : [normalize(String(actual))];
  return values.some(v => req.operator === "includes" ? v.includes(wanted) || wanted.includes(v) : v === wanted) ? "match" : "conflict";
}
export function evaluateEligibility(item: MailItem, profile: Profile): { eligibility: Eligibility; evidence: string[] } {
  if (!item.requirements.length) return { eligibility: "unknown", evidence: [] };
  const checks = item.requirements.map(req => ({ req, result: checkRequirement(req, profile) }));
  const evidence = checks.map(c => `${c.result}: ${c.req.evidence}`);
  if (checks.some(c => c.result === "conflict" && c.req.confidence === "high")) return { eligibility: "ineligible", evidence };
  if (checks.some(c => c.result === "unknown")) return { eligibility: checks.some(c => c.result === "match") ? "likely" : "unknown", evidence };
  return { eligibility: "eligible", evidence };
}
export function evaluateItem(item: MailItem, profile: Profile): Evaluation {
  const text = normalize(`${item.title} ${item.bodyText} ${item.tags.join(" ")}`);
  const eligibilityResult = evaluateEligibility(item, profile);
  const reasons: Evaluation["reasons"] = [];
  if (includesAny(text, engineeringWords)) reasons.push({ key: "engineering", points: profile.weights.engineering, label: "Engineering / AI / data" });
  if (item.compensation || includesAny(text, paidWords)) reasons.push({ key: "paid", points: profile.weights.paid, label: "Paid or compensated" });
  const interests = profile.interests.filter(i => text.includes(normalize(i)));
  if (interests.length) reasons.push({ key: "interests", points: profile.weights.interests, label: interests.slice(0, 3).join(" · ") });
  const languageMatch = item.requirements.some(r => ["nativeLanguage", "spokenLanguage"].includes(r.field) && checkRequirement(r, profile) === "match");
  if (languageMatch) reasons.push({ key: "language", points: profile.weights.language, label: "Language requirement matches" });
  if (includesAny(text, helperWords)) reasons.push({ key: "helper", points: profile.weights.helper, label: "Student / research helper" });
  if (eligibilityResult.eligibility === "unknown") reasons.push({ key: "unknown", points: -10, label: "Eligibility needs review" });
  return { ...eligibilityResult, reasons, score: Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0))) };
}
export const isEngineering = (item: MailItem) => includesAny(normalize(`${item.title} ${item.bodyText} ${item.tags.join(" ")}`), engineeringWords);
export const isHelper = (item: MailItem) => includesAny(normalize(`${item.title} ${item.bodyText}`), helperWords);
export const isClosingSoon = (item: MailItem) => !!item.deadline && new Date(item.deadline).getTime() - Date.now() <= 7 * 86400000 && new Date(item.deadline).getTime() >= Date.now();
export const isExcluded = (item: MailItem, profile: Profile) => profile.excluded.some(x => normalize(`${item.title} ${item.bodyText}`).includes(normalize(x)));
