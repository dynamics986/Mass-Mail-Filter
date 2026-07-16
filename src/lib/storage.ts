import type { LocalState, MailItem, Profile } from "../types";

const KEY = "cu-link-state-v1";
export const defaultProfile: Profile = {
  studentLevel: "undergraduate", major: "Engineering", nativeLanguages: ["Mandarin"], spokenLanguages: ["Mandarin", "Cantonese", "English"],
  health: [], skills: ["Python", "Web", "AI", "Data analysis"], interests: ["engineering", "software", "AI", "data analysis", "research assistant", "student helper"],
  excluded: ["clinical patient recruitment", "children recruitment"], preferPaid: true,
  weights: { engineering: 30, paid: 25, interests: 20, language: 15, helper: 10 }, language: "zh", onboarded: false
};
export const defaultState: LocalState = { profile: defaultProfile, hidden: [], favorites: {}, corrections: [] };

export function loadState(): LocalState {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...defaultState, ...JSON.parse(raw), profile: { ...defaultProfile, ...JSON.parse(raw).profile, weights: { ...defaultProfile.weights, ...JSON.parse(raw).profile?.weights } } } : defaultState; }
  catch { return defaultState; }
}
export function saveState(state: LocalState) { localStorage.setItem(KEY, JSON.stringify(state)); }
export function favoriteSnapshot(item: MailItem) { return { id: item.id, title: item.title, digestDate: item.digestDate, sourceUrl: item.sourceUrl, category: item.category, deadline: item.deadline, tags: item.tags }; }
export function exportState(state: LocalState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cu-link-settings.json"; a.click(); URL.revokeObjectURL(a.href);
}
export async function importState(file: File): Promise<LocalState> {
  const parsed = JSON.parse(await file.text());
  if (!parsed.profile || !Array.isArray(parsed.hidden) || typeof parsed.favorites !== "object") throw new Error("Invalid settings file");
  return { ...defaultState, ...parsed, profile: { ...defaultProfile, ...parsed.profile, weights: { ...defaultProfile.weights, ...parsed.profile.weights } } };
}
export function clearState() { localStorage.removeItem(KEY); localStorage.removeItem("cu-link-feed-cache"); localStorage.removeItem("cu-link-meta-cache"); }
