/** API secrets stay in a separate localStorage key and are never exported with profile JSON. */

const KEY = "cu-link-secrets-v1";

export interface AppSecrets {
  siliconflowApiKey: string;
  siliconflowModel: string;
  aiEnabled: boolean;
}

const DEFAULTS: AppSecrets = {
  siliconflowApiKey: "",
  siliconflowModel: "Qwen/Qwen2.5-14B-Instruct",
  aiEnabled: true,
};

export function loadSecrets(): AppSecrets {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AppSecrets>) : {};
    const secrets: AppSecrets = { ...DEFAULTS, ...parsed };
    // Dev-only seed from .env.development.local (not included in production builds).
    if (import.meta.env.DEV) {
      const envKey = (import.meta.env.VITE_SILICONFLOW_API_KEY as string | undefined)?.trim();
      if (!secrets.siliconflowApiKey && envKey) {
        secrets.siliconflowApiKey = envKey;
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
  return secrets.aiEnabled && secrets.siliconflowApiKey.trim().length > 8;
}
