import { afterEach, describe, expect, it, vi } from "vitest";
import type { MailItem, Profile } from "../types";
import { polishMany, sourceHash } from "./enhance";
import { AI_PROVIDERS, type AppSecrets } from "./secrets";

describe("polish cache source identity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("detects source changes beyond the old 800-character prefix", () => {
    const base = { title: "Title", summary: "Summary", bodyText: `${"a".repeat(900)}old` } as MailItem;
    const changed = { ...base, bodyText: `${"a".repeat(900)}new` };
    expect(sourceHash(base)).not.toBe(sourceHash(changed));
  });

  it("stops a batch after one provider-wide failure", async () => {
    const secrets: AppSecrets = {
      aiEnabled: true,
      provider: "deepseek",
      providers: Object.fromEntries(AI_PROVIDERS.map(provider => [provider.id, {
        apiKey: "test-api-key",
        model: provider.defaultModel || "endpoint-id",
        baseUrl: "",
      }])) as AppSecrets["providers"],
    };
    localStorage.setItem("cu-link-secrets-v2", JSON.stringify(secrets));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("denied", { status: 401 }));
    const items = [1, 2, 3].map(n => ({
      id: `batch-failure-${n}`,
      title: `Item ${n}`,
      summary: "Summary",
      bodyText: "Body",
      requirements: [],
      tags: [],
    })) as unknown as MailItem[];
    const profile = { language: "en", nativeLanguages: ["English"] } as Profile;

    const result = await polishMany(items, profile, { concurrency: 1 });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ polished: 0, failed: 1, unprocessed: 2, firstError: "AI_AUTH_INVALID" });
  });
});
