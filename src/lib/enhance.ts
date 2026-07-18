/** One-click AI polish with shared persistent cache (no repeat API calls). */

import { aiReady, loadSecrets } from "./secrets";
import { aiPolishOpportunity, POLISH_PROMPT_VERSION } from "./siliconflow";
import { looksMostlyEnglish, translateToZh, wantsChineseHelp } from "./translate";
import type { MailItem, Profile } from "../types";

/** v2 invalidates pre–structured-prompt polish cache. */
const STORE_KEY = "cu-link-polish-v2";

export interface PolishRecord {
  itemId: string;
  sourceHash: string;
  lang: "zh" | "en";
  title: string;
  summary: string;
  polishedAt: string;
  model: string;
  promptVersion: number;
}

type Store = Record<string, PolishRecord>;

const memory: Store = {};
const pending = new Map<string, Promise<PolishRecord>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

export function onPolishStoreChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readStore(): Store {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as Store;
    Object.assign(memory, all);
    return all;
  } catch {
    return { ...memory };
  }
}

function writeStore(all: Store) {
  Object.assign(memory, all);
  try {
    const keys = Object.keys(all);
    if (keys.length > 400) {
      const sorted = keys
        .map(k => ({ k, t: all[k]?.polishedAt || "" }))
        .sort((a, b) => a.t.localeCompare(b.t));
      for (const { k } of sorted.slice(0, keys.length - 400)) delete all[k];
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
  notify();
}

function hashText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function sourceHash(item: MailItem): string {
  return hashText(`${item.title}\n${item.summary || ""}\n${(item.bodyText || "").slice(0, 800)}`);
}

export function targetSummaryLang(profile: Profile): "zh" | "en" {
  return wantsChineseHelp(profile.nativeLanguages, profile.language) ? "zh" : profile.language;
}

function storeKey(itemId: string, lang: "zh" | "en"): string {
  return `${itemId}::${lang}`;
}

export function peekPolish(item: MailItem, profile: Profile): PolishRecord | undefined {
  const lang = targetSummaryLang(profile);
  const key = storeKey(item.id, lang);
  const all = Object.keys(memory).length ? memory : readStore();
  const hit = all[key] || memory[key];
  if (!hit) return undefined;
  if (hit.sourceHash !== sourceHash(item)) return undefined;
  if (hit.promptVersion !== POLISH_PROMPT_VERSION) return undefined;
  return hit;
}

export function hasFreshPolish(item: MailItem, profile: Profile): boolean {
  return !!peekPolish(item, profile);
}

export function polishCount(): number {
  return Object.keys(readStore()).length;
}

/** Polish once; returns cache hit without calling the API. */
export async function polishItem(
  item: MailItem,
  profile: Profile,
  opts?: { force?: boolean },
): Promise<PolishRecord> {
  const lang = targetSummaryLang(profile);
  const key = storeKey(item.id, lang);
  const hash = sourceHash(item);

  if (!opts?.force) {
    const hit = peekPolish(item, profile);
    if (hit) return hit;
  }

  const existing = pending.get(key);
  if (existing) return existing;

  const work = (async (): Promise<PolishRecord> => {
    const secrets = loadSecrets();
    let title = item.title;
    let summary = item.summary?.trim() || item.title;

    if (aiReady(secrets)) {
      const out = await aiPolishOpportunity({
        title: item.title,
        summary: item.summary,
        bodyText: item.cleanBody || item.bodyText,
        lang,
        taxonomyType: item.taxonomy?.type,
        category: item.category,
        compensation: item.compensation,
        deadline: item.deadline,
        deadlineKind: item.deadlineKind,
        deadlineEvidence: item.deadlineEvidence,
        requirements: item.requirements,
        tags: item.tags,
      });
      title = out.title || title;
      summary = out.summary || summary;
    } else if (lang === "zh") {
      if (looksMostlyEnglish(item.title)) title = await translateToZh(item.title);
      if (looksMostlyEnglish(summary)) summary = await translateToZh(summary);
    }

    const record: PolishRecord = {
      itemId: item.id,
      sourceHash: hash,
      lang,
      title,
      summary,
      polishedAt: new Date().toISOString(),
      model: aiReady(secrets) ? secrets.siliconflowModel : "local",
      promptVersion: POLISH_PROMPT_VERSION,
    };
    const all = readStore();
    all[key] = record;
    writeStore(all);
    return record;
  })().finally(() => pending.delete(key));

  pending.set(key, work);
  return work;
}

export async function polishMany(
  items: MailItem[],
  profile: Profile,
  opts?: { concurrency?: number; onProgress?: (done: number, total: number) => void },
): Promise<{ polished: number; skipped: number; failed: number }> {
  const concurrency = opts?.concurrency ?? 2;
  let polished = 0;
  let skipped = 0;
  let failed = 0;
  let done = 0;
  const total = items.length;
  const queue = [...items];

  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      try {
        if (hasFreshPolish(item, profile)) {
          skipped += 1;
        } else {
          await polishItem(item, profile);
          polished += 1;
        }
      } catch {
        failed += 1;
      } finally {
        done += 1;
        opts?.onProgress?.(done, total);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
  return { polished, skipped, failed };
}

/** @deprecated use peekPolish */
export function peekEnhancedSummary(item: MailItem, profile: Profile): string | undefined {
  return peekPolish(item, profile)?.summary;
}

/** @deprecated use polishItem */
export async function enhanceSummary(item: MailItem, profile: Profile): Promise<string> {
  return (await polishItem(item, profile)).summary;
}
