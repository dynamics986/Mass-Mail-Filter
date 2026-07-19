/** SiliconFlow OpenAI-compatible chat for summary + translation. */

import { activeProvider, aiReady, loadSecrets, type AppSecrets } from "./secrets";
import type { Compensation, L1Type, Requirement } from "../types";
import { nonRedundantSummary } from "./textCleanup";

/** Prompt schema version — bump when output format changes (pairs with polish store v2). */
export const POLISH_PROMPT_VERSION = 2;

const CATEGORY_ZH: Record<L1Type, string> = {
  paid_work: "有薪工作",
  research: "研究",
  event: "活动",
  programme: "课程项目",
  competition: "竞赛",
  service: "志愿",
  admin: "其他",
};

const CATEGORY_EN: Record<L1Type, string> = {
  paid_work: "Paid work",
  research: "Research",
  event: "Event",
  programme: "Programme",
  competition: "Competition",
  service: "Volunteer",
  admin: "Other",
};

const ALLOWED_CATEGORIES_ZH = "有薪工作|研究|活动|课程项目|志愿|竞赛|奖学金|实习|其他";
const ALLOWED_CATEGORIES_EN =
  "Paid work|Research|Event|Programme|Volunteer|Competition|Scholarship|Internship|Other";

export async function siliconChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts?: { maxTokens?: number; temperature?: number; secrets?: AppSecrets; timeoutMs?: number },
): Promise<string> {
  const secrets = opts?.secrets ?? loadSecrets();
  if (!aiReady(secrets)) throw new Error("AI_CONFIG_INCOMPLETE");
  const { config, baseUrl } = activeProvider(secrets);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), opts?.timeoutMs ?? 30000);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages,
        max_tokens: opts?.maxTokens ?? 320,
        temperature: opts?.temperature ?? 0.2,
      }),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new Error("AI_TIMEOUT");
    throw new Error("AI_NETWORK_ERROR");
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error("AI_AUTH_INVALID");
    if (res.status === 403) throw new Error("AI_PERMISSION_DENIED");
    if (res.status === 404 || res.status === 400) throw new Error("AI_MODEL_UNAVAILABLE");
    if (res.status === 429) throw new Error("AI_RATE_LIMITED");
    throw new Error(`AI_HTTP_${res.status}`);
  }
  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error("AI_RESPONSE_INVALID");
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI_RESPONSE_INVALID");
  return text.replace(/^["']|["']$/g, "").trim();
}

export async function aiTranslateToZh(text: string): Promise<string> {
  return siliconChat(
    [
      {
        role: "system",
        content:
          "你是港中文（CUHK）通知翻译助手。把英文准确译成简体中文，保留专有名词原文（学院名、项目名、人名）。只输出译文，不要解释。",
      },
      { role: "user", content: text.slice(0, 2400) },
    ],
    { maxTokens: 500, temperature: 0.1 },
  );
}

function formatCompensation(c?: Compensation): string {
  if (!c) return "";
  const range =
    c.minHkd != null || c.maxHkd != null
      ? `HK$${c.minHkd ?? "?"}${c.maxHkd != null && c.maxHkd !== c.minHkd ? `–${c.maxHkd}` : ""}`
      : "";
  return [c.type !== "unknown" ? c.type : "", range].filter(Boolean).join(" ");
}

function formatRequirements(reqs: Requirement[]): string {
  return reqs
    .slice(0, 5)
    .map(r => `${r.field}:${r.operator}:${String(r.value).slice(0, 48)}`)
    .join("; ");
}

const RELEVANT_SOURCE = /(?:hk\$|hkd|薪|酬|津貼|津贴|獎金|奖金|截止|deadline|apply|eligible|eligibility|資格|资格|對象|对象|year|student|language|語言|语言|hour|date|日期)/i;

/** Build a compact evidence excerpt instead of paying to resend the full email. */
export function compactPolishExcerpt(title: string, summary: string, bodyText: string, maxChars = 900): string {
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  const normalizedSummary = summary.replace(/\s+/g, " ").trim();
  const chunks = bodyText
    .split(/\n+|(?<=[。！？.!?])\s+/)
    .map(part => part.replace(/\s+/g, " ").trim())
    .filter(part => part.length >= 12 && part !== normalizedTitle && part !== normalizedSummary);
  const selected: string[] = [];
  const add = (part: string) => {
    if (!part || selected.includes(part)) return;
    const next = [...selected, part].join("\n");
    if (next.length <= maxChars) selected.push(part);
  };
  chunks.filter(part => RELEVANT_SOURCE.test(part)).slice(0, 8).forEach(add);
  chunks.slice(0, 3).forEach(add);
  return selected.join("\n").slice(0, maxChars);
}

function hintCategory(taxonomyType: L1Type | undefined, category: string | undefined, lang: "zh" | "en"): string {
  if (taxonomyType) return lang === "zh" ? CATEGORY_ZH[taxonomyType] : CATEGORY_EN[taxonomyType];
  return category || (lang === "zh" ? "其他" : "Other");
}

function buildUserPayload(input: {
  title: string;
  summary: string;
  bodyText?: string;
  lang: "zh" | "en";
  taxonomyType?: L1Type;
  category?: string;
  compensation?: Compensation;
  deadline?: string;
  deadlineKind?: string;
  deadlineEvidence?: string;
  requirements?: Requirement[];
  tags?: string[];
}): string {
  const hint = hintCategory(input.taxonomyType, input.category, input.lang);
  const usefulSummary = nonRedundantSummary(input.title, input.summary);
  const excerpt = compactPolishExcerpt(input.title, usefulSummary || "", input.bodyText || "");
  const lines = [
    `category=${hint}`,
    `pay=${formatCompensation(input.compensation) || "unknown"}`,
    `deadline=${input.deadline || input.deadlineKind || "unknown"}`,
    `deadline_evidence=${(input.deadlineEvidence || "").slice(0, 120)}`,
    `requirements=${formatRequirements(input.requirements || []) || "none"}`,
    `tags=${(input.tags || []).slice(0, 4).join(",")}`,
    `title=${input.title.slice(0, 500)}`,
    usefulSummary ? `summary=${usefulSummary.slice(0, 280)}` : "",
    excerpt ? `evidence=${excerpt}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function normalizeSummary(
  category: string,
  summary: string,
  lang: "zh" | "en",
): string {
  let s = summary.replace(/\s+/g, " ").trim();
  const bracket = lang === "zh" ? `【${category}】` : `[${category}]`;
  if (!s.startsWith("【") && !s.startsWith("[")) {
    s = `${bracket}${s}`;
  }
  // Ensure pay / deadline / audience slots exist (append if model omitted).
  if (lang === "zh") {
    if (!/薪酬[：:]/.test(s)) s += " 薪酬：未标明。";
    if (!/截止[：:]|日期[：:]|活动日[：:]/.test(s)) s += " 截止：未标明。";
    if (!/对象[：:]/.test(s)) s += " 对象：未标明。";
  } else {
    if (!/Pay\s*:/i.test(s)) s += " Pay: not stated.";
    if (!/Deadline\s*:|Date\s*:/i.test(s)) s += " Deadline: not stated.";
    if (!/For\s*:|Audience\s*:/i.test(s)) s += " For: not stated.";
  }
  return s.replace(/\s+/g, " ").trim();
}

export async function aiPolishOpportunity(input: {
  title: string;
  summary: string;
  bodyText?: string;
  lang: "zh" | "en";
  taxonomyType?: L1Type;
  category?: string;
  compensation?: Compensation;
  deadline?: string;
  deadlineKind?: string;
  deadlineEvidence?: string;
  requirements?: Requirement[];
  tags?: string[];
}): Promise<{ title: string; summary: string; category: string }> {
  const hint = hintCategory(input.taxonomyType, input.category, input.lang);

  const systemZh = [
    "编辑 CUHK 机会卡片。只输出 JSON，无 Markdown/解释。",
    '格式：{"category":"...","title":"...","summary":"..."}',
    `category 仅限：${ALLOWED_CATEGORIES_ZH}；优先使用 category 提示。`,
    "title 为简短标题，保留专有名词，不加类目前缀。",
    "summary 为60–120字单段：【类目】是什么/做什么。薪酬：…。截止：…。对象：…。",
    "金额、日期、资格只依据输入；未知写「未标明」，不得推测。禁止列表。",
  ].join("\n");

  const systemEn = [
    "Edit a CUHK opportunity card. Return JSON only; no Markdown or explanation.",
    'Schema: {"category":"...","title":"...","summary":"..."}',
    `category: one of ${ALLOWED_CATEGORIES_EN}; prefer the category hint.`,
    "title: short, no category prefix; preserve proper names.",
    "summary: one short paragraph: [Category] what it is. Pay: …. Deadline: …. For: ….",
    "Use only supplied facts for money, dates, and eligibility; write 'not stated' when unknown. No bullets.",
  ].join("\n");

  const raw = await siliconChat(
    [
      { role: "system", content: input.lang === "zh" ? systemZh : systemEn },
      { role: "user", content: buildUserPayload(input) },
    ],
    { maxTokens: 220, temperature: 0.1 },
  );

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        category?: string;
        title?: string;
        summary?: string;
      };
      const category = (parsed.category || hint).trim() || hint;
      const title = (parsed.title || input.title).trim();
      const summary = normalizeSummary(category, parsed.summary || input.summary || input.title, input.lang);
      return { title, summary, category };
    } catch {
      /* fall through */
    }
  }
  return {
    title: input.title,
    summary: normalizeSummary(hint, raw.slice(0, 280), input.lang),
    category: hint,
  };
}

export async function aiSummarizeOpportunity(input: {
  title: string;
  summary: string;
  bodyText?: string;
  lang: "zh" | "en";
}): Promise<string> {
  return (await aiPolishOpportunity(input)).summary;
}

export async function testAiConnection(secrets?: AppSecrets): Promise<string> {
  // Testing validates the current form values even when the optional AI
  // feature is switched off. The global toggle only controls normal usage.
  const testingSecrets = { ...(secrets ?? loadSecrets()), aiEnabled: true };
  return siliconChat(
    [{ role: "user", content: "Reply with exactly: OK" }],
    { maxTokens: 8, temperature: 0, secrets: testingSecrets, timeoutMs: 20000 },
  );
}

export function aiErrorMessage(error: unknown, lang: "zh" | "en"): string {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, { zh: string; en: string }> = {
    AI_CONFIG_INCOMPLETE: { zh: "请填写 API Key 和模型 ID。", en: "Enter an API key and model ID." },
    AI_AUTH_INVALID: { zh: "认证失败（401）：请确认 Key 属于当前所选服务商。", en: "Authentication failed (401). Check that the key belongs to the selected provider." },
    AI_PERMISSION_DENIED: { zh: "请求被拒绝（403）：请检查 Key 或模型权限。", en: "Request denied (403). Check key and model permissions." },
    AI_MODEL_UNAVAILABLE: { zh: "模型不可用：请核对模型/接入点 ID 和 Base URL。", en: "Model unavailable. Check the model/endpoint ID and Base URL." },
    AI_RATE_LIMITED: { zh: "请求过于频繁或额度不足，请稍后重试并检查账户余额。", en: "Rate limit or quota reached. Try later and check the account balance." },
    AI_NETWORK_ERROR: { zh: "无法连接服务商。请检查网络、Base URL，以及该平台是否允许浏览器跨域请求。", en: "Could not reach the provider. Check the network, Base URL, and browser CORS support." },
    AI_TIMEOUT: { zh: "连接测试超时（20 秒）。请检查网络、Base URL 或服务商状态后重试。", en: "Connection test timed out after 20 seconds. Check the network, Base URL, or provider status and try again." },
    AI_RESPONSE_INVALID: { zh: "服务商返回了无法识别的响应。", en: "The provider returned an unsupported response." },
  };
  return messages[code]?.[lang] ?? (lang === "zh" ? "连接失败，请检查配置后重试。" : "Connection failed. Check the configuration and try again.");
}
