/** Browser EN→ZH for summaries: Chrome Translator → OPUS-MT → MyMemory fallback. */

export type TranslateStatus = "idle" | "loading" | "ready" | "error";

type Translator = (text: string, opts?: { max_new_tokens?: number }) => Promise<Array<{ translation_text: string }>>;

let translatorPromise: Promise<Translator> | null = null;
let status: TranslateStatus = "idle";
const listeners = new Set<(s: TranslateStatus) => void>();
const memoryCache = new Map<string, string>();
const CACHE_KEY = "cu-link-zh-cache-v1";
const pending = new Map<string, Promise<string>>();
let queue: Array<() => void> = [];
let active = 0;
const MAX_CONCURRENT = 1;

function setStatus(next: TranslateStatus) {
  status = next;
  listeners.forEach(fn => fn(next));
}

export function getTranslateStatus(): TranslateStatus {
  return status;
}

export function onTranslateStatus(fn: (s: TranslateStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function wantsChineseHelp(nativeLanguages: string[], uiLang: "zh" | "en"): boolean {
  if (uiLang === "zh") return true;
  return nativeLanguages.some(l =>
    /chinese|mandarin|cantonese|putonghua|中文|普通话|普通話|粤|粵|國語|国语|漢語|汉语/i.test(l),
  );
}

export function looksMostlyEnglish(text: string): boolean {
  const sample = text.slice(0, 500);
  if (!sample.trim()) return false;
  const letters = (sample.match(/[A-Za-z]/g) || []).length;
  const cjk = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  // Short English blurbs still count (titles / one-line summaries).
  return letters >= 12 && letters > cjk;
}

function cacheGet(key: string): string | undefined {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const all = JSON.parse(raw) as Record<string, string>;
    if (all[key]) {
      memoryCache.set(key, all[key]);
      return all[key];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function cacheSet(key: string, value: string) {
  memoryCache.set(key, value);
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    all[key] = value;
    const keys = Object.keys(all);
    if (keys.length > 200) {
      for (const k of keys.slice(0, keys.length - 200)) delete all[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode */
  }
}

function hashKey(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

async function translateChrome(text: string): Promise<string | null> {
  const translation = (self as unknown as { translation?: {
    canTranslate?: (o: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
    createTranslator?: (o: { sourceLanguage: string; targetLanguage: string }) => Promise<{
      translate: (t: string) => Promise<string>;
    }>;
  } }).translation;
  if (!translation?.createTranslator || !translation.canTranslate) return null;
  try {
    const avail = await translation.canTranslate({ sourceLanguage: "en", targetLanguage: "zh-Hans" });
    if (avail !== "readily" && avail !== "after-download") return null;
    const translator = await translation.createTranslator({
      sourceLanguage: "en",
      targetLanguage: "zh-Hans",
    });
    return (await translator.translate(text)).trim() || null;
  } catch {
    return null;
  }
}

async function loadOpus(): Promise<Translator> {
  if (!translatorPromise) {
    setStatus("loading");
    translatorPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      const pipe = await pipeline("translation", "Xenova/opus-mt-en-zh");
      setStatus("ready");
      return pipe as unknown as Translator;
    })().catch(err => {
      translatorPromise = null;
      setStatus("error");
      throw err;
    });
  }
  return translatorPromise;
}

async function translateOpus(text: string): Promise<string> {
  const chunks: string[] = [];
  const parts = text.split(/(?<=[.!?。！？])\s+/);
  let buf = "";
  for (const part of parts) {
    if ((buf + " " + part).length > 360) {
      if (buf) chunks.push(buf);
      buf = part;
    } else {
      buf = buf ? `${buf} ${part}` : part;
    }
  }
  if (buf) chunks.push(buf);
  const translator = await loadOpus();
  const out: string[] = [];
  for (const chunk of chunks.slice(0, 6)) {
    const result = await translator(chunk, { max_new_tokens: 256 });
    out.push(result[0]?.translation_text?.trim() || chunk);
  }
  return out.join(" ");
}

/** Short-text fallback when on-device models are unavailable. */
async function translateMyMemory(text: string): Promise<string> {
  const q = text.slice(0, 480);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|zh-CN`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("mymemory failed");
  const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
  const translated = data.responseData?.translatedText?.trim();
  if (!translated || data.responseStatus !== 200) throw new Error("mymemory empty");
  // MyMemory sometimes echoes the query on failure.
  if (translated.toLowerCase() === q.toLowerCase()) throw new Error("mymemory echo");
  return translated;
}

async function translateOnce(text: string): Promise<string> {
  try {
    const { aiReady } = await import("./secrets");
    if (aiReady()) {
      const { aiTranslateToZh } = await import("./siliconflow");
      return await aiTranslateToZh(text);
    }
  } catch {
    /* fall through to on-device / free APIs */
  }
  const chrome = await translateChrome(text);
  if (chrome) return chrome;
  try {
    return await translateOpus(text);
  } catch {
    return translateMyMemory(text);
  }
}

function runQueue() {
  while (active < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    if (!job) break;
    active += 1;
    job();
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => {
      fn()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          runQueue();
        });
    });
    runQueue();
  });
}

export async function translateToZh(text: string): Promise<string> {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const key = hashKey(clean);
  const hit = cacheGet(key);
  if (hit) return hit;
  const existing = pending.get(key);
  if (existing) return existing;

  const work = enqueue(async () => {
    const zh = await translateOnce(clean);
    cacheSet(key, zh);
    return zh;
  }).finally(() => pending.delete(key));

  pending.set(key, work);
  return work;
}

export async function warmTranslator(): Promise<void> {
  if (await translateChrome("hello")) {
    setStatus("ready");
    return;
  }
  try {
    await loadOpus();
  } catch {
    setStatus("ready"); // MyMemory still available
  }
}

export function peekCachedZh(text: string): string | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return cacheGet(hashKey(clean));
}
