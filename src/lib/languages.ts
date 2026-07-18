/** Fixed language options for onboarding / settings (no free-text). */

export interface LangOption {
  id: string;
  zh: string;
  en: string;
}

export const LANGUAGE_OPTIONS: LangOption[] = [
  { id: "Cantonese", zh: "粤语", en: "Cantonese" },
  { id: "Mandarin", zh: "普通话 / 国语", en: "Mandarin" },
  { id: "English", zh: "英语", en: "English" },
  { id: "Japanese", zh: "日语", en: "Japanese" },
  { id: "Korean", zh: "韩语", en: "Korean" },
  { id: "French", zh: "法语", en: "French" },
  { id: "German", zh: "德语", en: "German" },
  { id: "Spanish", zh: "西班牙语", en: "Spanish" },
  { id: "Portuguese", zh: "葡萄牙语", en: "Portuguese" },
  { id: "Hindi", zh: "印地语", en: "Hindi" },
  { id: "Other", zh: "其他", en: "Other" },
];

export function normalizeLanguageList(values: string[]): string[] {
  const known = new Set(LANGUAGE_OPTIONS.map(o => o.id));
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    if (known.has(v)) {
      if (!out.includes(v)) out.push(v);
      continue;
    }
    // Map legacy free-text values into checklist ids.
    if (/cantonese|粤|粵/i.test(v) && !out.includes("Cantonese")) out.push("Cantonese");
    else if (/mandarin|putonghua|中文|普通话|普通話|國語|国语|漢語|汉语|chinese/i.test(v) && !out.includes("Mandarin"))
      out.push("Mandarin");
    else if (/english|英文|英語|英语/i.test(v) && !out.includes("English")) out.push("English");
    else if (!out.includes("Other")) out.push("Other");
  }
  return out;
}

export function toggleLanguage(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}
