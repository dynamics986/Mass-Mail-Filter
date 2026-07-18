import type { FavoriteSnapshot, LocalState, MailItem, Profile } from "../types";
import { normalizeLanguageList } from "./languages";

const KEY = "cu-link-state-v2";

export const defaultWeights = {
  fit: 30,
  urgent: 20,
  value: 20,
  meaningful: 20,
  important: 10,
};

export const defaultProfile: Profile = {
  studentLevel: "undergraduate",
  facultyId: "",
  programmeId: "",
  major: "",
  year: "",
  nativeLanguages: ["Cantonese"],
  spokenLanguages: ["Cantonese", "Mandarin", "English"],
  goals: ["paid", "research"],
  skills: [],
  excluded: ["clinical patient recruitment"],
  preferPaid: true,
  weights: { ...defaultWeights },
  language: "zh",
  onboarded: false,
};

export const defaultState: LocalState = {
  profile: { ...defaultProfile },
  hidden: [],
  favorites: {},
  corrections: [],
  importedItems: [],
};

export function loadState(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw) as LocalState;
    const profile = {
      ...defaultProfile,
      ...parsed.profile,
      weights: { ...defaultWeights, ...parsed.profile?.weights },
    };
    profile.nativeLanguages = normalizeLanguageList(profile.nativeLanguages ?? defaultProfile.nativeLanguages);
    profile.spokenLanguages = normalizeLanguageList(profile.spokenLanguages ?? defaultProfile.spokenLanguages);
    return {
      ...defaultState,
      ...parsed,
      profile,
      favorites: parsed.favorites ?? {},
      hidden: parsed.hidden ?? [],
      corrections: parsed.corrections ?? [],
      importedItems: parsed.importedItems ?? [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state: LocalState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}

export function favoriteSnapshot(item: MailItem): FavoriteSnapshot {
  return {
    id: item.id,
    title: item.title,
    sourceUrl: item.sourceUrl,
    deadline: item.deadline,
    summary: item.summary,
    savedAt: new Date().toISOString(),
  };
}

export function exportState(state: LocalState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cu-link-settings.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importState(file: File): Promise<LocalState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as LocalState;
  saveState(parsed);
  return loadState();
}
