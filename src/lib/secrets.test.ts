import { beforeEach, describe, expect, it } from "vitest";
import { AI_PROVIDERS, loadSecrets } from "./secrets";

describe("AI secrets", () => {
  beforeEach(() => localStorage.clear());

  it("provides an independent configuration for every provider", () => {
    const secrets = loadSecrets();
    expect(Object.keys(secrets.providers)).toEqual(AI_PROVIDERS.map(p => p.id));
    for (const provider of AI_PROVIDERS) {
      expect(secrets.providers[provider.id].model).toBe(provider.defaultModel);
    }
  });

  it("migrates the legacy SiliconFlow configuration", () => {
    localStorage.setItem("cu-link-secrets-v1", JSON.stringify({
      siliconflowApiKey: "sk-legacy-key-value",
      siliconflowModel: "legacy/model",
      aiEnabled: false,
    }));
    const secrets = loadSecrets();
    expect(secrets.provider).toBe("siliconflow");
    expect(secrets.providers.siliconflow).toMatchObject({
      apiKey: "sk-legacy-key-value",
      model: "legacy/model",
    });
    expect(secrets.aiEnabled).toBe(false);
    expect(localStorage.getItem("cu-link-secrets-v2")).toBeTruthy();
  });
});
