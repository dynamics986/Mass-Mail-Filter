/** API secrets stay in a separate localStorage key and are never exported with profile JSON. */

const KEY = "cu-link-secrets-v2";
const LEGACY_KEY = "cu-link-secrets-v1";

export type AiProvider =
  | "siliconflow"
  | "deepseek"
  | "kimi"
  | "aliyun"
  | "baidu"
  | "volcengine"
  | "zhipu"
  | "modelscope"
  | "minimax"
  | "hunyuan"
  | "openai"
  | "openrouter";

export interface ProviderSecrets {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ProviderDefinition {
  id: AiProvider;
  zh: string;
  en: string;
  baseUrl: string;
  defaultModel: string;
  modelHint?: { zh: string; en: string };
  keyHint: { zh: string; en: string };
}

export const AI_PROVIDERS: ProviderDefinition[] = [
  { id: "siliconflow", zh: "硅基流动", en: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1", defaultModel: "deepseek-ai/DeepSeek-V3", keyHint: { zh: "例如：sk-…", en: "Example: sk-…" } },
  { id: "deepseek", zh: "DeepSeek", en: "DeepSeek", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-chat", keyHint: { zh: "例如：sk-…", en: "Example: sk-…" } },
  { id: "kimi", zh: "Kimi", en: "Kimi", baseUrl: "https://api.moonshot.ai/v1", defaultModel: "kimi-k2.6", keyHint: { zh: "粘贴 Kimi 开放平台 API Key", en: "Paste a Kimi Platform API key" } },
  { id: "aliyun", zh: "阿里云百炼", en: "Alibaba Cloud Model Studio", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus", keyHint: { zh: "粘贴 DashScope API Key", en: "Paste a DashScope API key" } },
  { id: "baidu", zh: "百度智能云千帆", en: "Baidu Qianfan", baseUrl: "https://qianfan.baidubce.com/v2", defaultModel: "ernie-4.5-turbo-128k", keyHint: { zh: "粘贴千帆 API Key", en: "Paste a Qianfan API key" } },
  {
    id: "volcengine",
    zh: "豆包（火山方舟）",
    en: "Doubao (Volcengine Ark)",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "",
    modelHint: { zh: "填写模型或推理接入点 ID", en: "Enter a model or endpoint ID" },
    keyHint: { zh: "粘贴火山方舟 API Key", en: "Paste a Volcengine Ark API key" },
  },
  { id: "zhipu", zh: "智谱 AI", en: "Zhipu AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4.5-flash", keyHint: { zh: "例如：ID.secret", en: "Example: ID.secret" } },
  { id: "modelscope", zh: "魔搭 ModelScope", en: "ModelScope", baseUrl: "https://api-inference.modelscope.cn/v1", defaultModel: "Qwen/Qwen3.5-35B-A3B", keyHint: { zh: "粘贴 ModelScope Access Token（不是 sk- Key）", en: "Paste a ModelScope Access Token (not an sk- key)" } },
  { id: "minimax", zh: "MiniMax", en: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", defaultModel: "MiniMax-M2.5", keyHint: { zh: "粘贴 MiniMax API Key", en: "Paste a MiniMax API key" } },
  { id: "hunyuan", zh: "腾讯混元", en: "Tencent Hunyuan", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", defaultModel: "hunyuan-turbos-latest", keyHint: { zh: "粘贴腾讯混元 API Key", en: "Paste a Tencent Hunyuan API key" } },
  { id: "openai", zh: "OpenAI", en: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-5-mini", keyHint: { zh: "例如：sk-proj-…", en: "Example: sk-proj-…" } },
  { id: "openrouter", zh: "OpenRouter", en: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-5-mini", keyHint: { zh: "例如：sk-or-v1-…", en: "Example: sk-or-v1-…" } },
];

export interface AppSecrets {
  provider: AiProvider;
  providers: Record<AiProvider, ProviderSecrets>;
  aiEnabled: boolean;
}

const providerDefaults = (): Record<AiProvider, ProviderSecrets> => Object.fromEntries(
  AI_PROVIDERS.map(p => [p.id, { apiKey: "", model: p.defaultModel, baseUrl: "" }]),
) as Record<AiProvider, ProviderSecrets>;

const DEFAULTS: AppSecrets = {
  provider: "siliconflow",
  providers: providerDefaults(),
  aiEnabled: true,
};

function normalize(parsed: Partial<AppSecrets>): AppSecrets {
  const providers = providerDefaults();
  for (const definition of AI_PROVIDERS) {
    const saved = parsed.providers?.[definition.id];
    if (saved) providers[definition.id] = { ...providers[definition.id], ...saved };
  }
  return { ...DEFAULTS, ...parsed, providers };
}

export function loadSecrets(): AppSecrets {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as { siliconflowApiKey?: string; siliconflowModel?: string; aiEnabled?: boolean };
        const migrated = normalize({ aiEnabled: legacy.aiEnabled });
        migrated.providers.siliconflow.apiKey = legacy.siliconflowApiKey || "";
        migrated.providers.siliconflow.model = legacy.siliconflowModel || migrated.providers.siliconflow.model;
        saveSecrets(migrated);
        return migrated;
      }
    }
    const parsed = raw ? (JSON.parse(raw) as Partial<AppSecrets>) : {};
    const secrets = normalize(parsed);
    // Dev-only seed from .env.development.local (not included in production builds).
    if (import.meta.env.DEV) {
      const envKey = (import.meta.env.VITE_SILICONFLOW_API_KEY as string | undefined)?.trim();
      if (!secrets.providers.siliconflow.apiKey && envKey) {
        secrets.providers.siliconflow.apiKey = envKey;
        secrets.provider = "siliconflow";
        secrets.aiEnabled = true;
        saveSecrets(secrets);
      }
    }
    return secrets;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSecrets(secrets: AppSecrets): void {
  localStorage.setItem(KEY, JSON.stringify(secrets));
}

export function maskKey(key: string): string {
  if (!key || key.length < 12) return key ? "••••" : "";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function aiReady(secrets: AppSecrets = loadSecrets()): boolean {
  const active = secrets.providers[secrets.provider];
  return secrets.aiEnabled && active.apiKey.trim().length > 8 && active.model.trim().length > 0;
}

export function activeProvider(secrets: AppSecrets = loadSecrets()) {
  const definition = AI_PROVIDERS.find(p => p.id === secrets.provider) ?? AI_PROVIDERS[0];
  const config = secrets.providers[definition.id];
  return { definition, config, baseUrl: config.baseUrl?.trim() || definition.baseUrl };
}
