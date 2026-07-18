/** SiliconFlow OpenAI-compatible chat for summary + translation. */

import { aiReady, loadSecrets, type AppSecrets } from "./secrets";
import type { Compensation, L1Type, Requirement } from "../types";

const BASE = "https://api.siliconflow.cn/v1/chat/completions";

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
  opts?: { maxTokens?: number; temperature?: number; secrets?: AppSecrets },
): Promise<string> {
  const secrets = opts?.secrets ?? loadSecrets();
  if (!aiReady(secrets)) throw new Error("SiliconFlow API key not configured");

  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secrets.siliconflowApiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: secrets.siliconflowModel || "Qwen/Qwen2.5-14B-Instruct",
      messages,
      max_tokens: opts?.maxTokens ?? 320,
      temperature: opts?.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SiliconFlow ${res.status}: ${body.slice(0, 180)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("SiliconFlow empty response");
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
    .slice(0, 8)
    .map(r => `${r.field} ${r.operator} ${r.value}`)
    .join("; ");
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
  const lines = [
    `hint_category: ${hint}`,
    `taxonomy_type: ${input.taxonomyType || "unknown"}`,
    `raw_category: ${input.category || ""}`,
    `compensation: ${formatCompensation(input.compensation) || "unknown"}`,
    `deadline: ${input.deadline || "unknown"}`,
    `deadline_kind: ${input.deadlineKind || "unknown"}`,
    `deadline_evidence: ${(input.deadlineEvidence || "").slice(0, 200)}`,
    `requirements: ${formatRequirements(input.requirements || []) || "none"}`,
    `tags: ${(input.tags || []).slice(0, 8).join(", ")}`,
    "",
    `title: ${input.title}`,
    `existing_summary: ${input.summary || ""}`,
    "",
    "body:",
    (input.bodyText || "").slice(0, 1600),
  ];
  return lines.join("\n");
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
    "你是港中文（CUHK）Undergraduate Digest 机会卡片文案编辑。",
    "只输出一个 JSON 对象，不要 markdown 代码块，不要解释。",
    '格式严格为：{"category":"...","title":"...","summary":"..."}',
    `category 必须是以下之一：${ALLOWED_CATEGORIES_ZH}。优先采用 user 里的 hint_category / taxonomy_type。`,
    "title：短标题，不要带【类目】前缀，不要整句广告腔。",
    "summary 必须是单段纯文本，固定骨架（顺序不可改）：",
    "【类目】一句话说明是什么/做什么。薪酬：…。截止：…。对象：…。",
    "规则：",
    "- 以【类目】开头（类目=category）。",
    "- 薪酬：有金额写 HK$…（时薪/津贴/奖金照抄）；明确无薪写「无薪/志愿」；看不出写「未标明」。",
    "- 截止：申请截止或活动日期；滚动招募写「滚动」；看不出写「未标明」。可参考 deadline 字段。",
    "- 对象：年级/学院/身份；看不出写「未标明」。",
    "- 总长约 60–120 汉字；禁止列表、禁止 bullet、禁止「以下是」类开场白。",
    "- 专有名词可保留英文。",
  ].join("\n");

  const systemEn = [
    "You edit CUHK Undergraduate Digest opportunity cards.",
    "Return ONLY one JSON object. No markdown fences. No preamble.",
    'Schema: {"category":"...","title":"...","summary":"..."}',
    `category must be one of: ${ALLOWED_CATEGORIES_EN}. Prefer hint_category / taxonomy_type from the user message.`,
    "title: short headline without a category prefix.",
    "summary must be one plain paragraph with this exact skeleton (order fixed):",
    "[Category] One sentence on what it is. Pay: …. Deadline: …. For: ….",
    "Rules:",
    "- Start with [Category] where Category equals category.",
    "- Pay: amount as HK$… when known; unpaid/volunteer if clear; else 'not stated'.",
    "- Deadline: apply-by or event date; 'rolling' if rolling; else 'not stated'. Use deadline fields when present.",
    "- For: year/faculty/who; else 'not stated'.",
    "- 2–3 short sentences total. No bullets, no markdown, no preamble.",
  ].join("\n");

  const raw = await siliconChat(
    [
      { role: "system", content: input.lang === "zh" ? systemZh : systemEn },
      { role: "user", content: buildUserPayload(input) },
    ],
    { maxTokens: 400, temperature: 0.2 },
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

export async function testSiliconflowKey(secrets?: AppSecrets): Promise<string> {
  return siliconChat(
    [{ role: "user", content: "Reply with exactly: OK" }],
    { maxTokens: 8, temperature: 0, secrets },
  );
}
