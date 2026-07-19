import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS, type AppSecrets } from "./secrets";
import { aiErrorMessage, aiPolishOpportunity, compactPolishExcerpt, testAiConnection } from "./siliconflow";

const makeSecrets = (provider: AppSecrets["provider"]): AppSecrets => ({
  aiEnabled: true,
  provider,
  providers: Object.fromEntries(AI_PROVIDERS.map(definition => [definition.id, {
    apiKey: `key-for-${definition.id}`,
    model: definition.defaultModel || "ep-test",
    baseUrl: "",
  }])) as AppSecrets["providers"],
});

describe("multi-provider AI client", () => {
  afterEach(() => vi.restoreAllMocks());

  for (const definition of AI_PROVIDERS) {
    it(`uses the ${definition.id} endpoint and model`, async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
        choices: [{ message: { content: "OK" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
      const secrets = makeSecrets(definition.id);
      await expect(testAiConnection(secrets)).resolves.toBe("OK");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${definition.baseUrl}/chat/completions`);
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer key-for-${definition.id}`);
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: secrets.providers[definition.id].model });
    });
  }

  it("honors a custom base URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }), { status: 200 }));
    const secrets = makeSecrets("aliyun");
    secrets.providers.aliyun.baseUrl = "https://workspace.example/v1/";
    await testAiConnection(secrets);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://workspace.example/v1/chat/completions");
  });

  it("tests current form credentials even when AI usage is disabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }), { status: 200 }));
    const secrets = makeSecrets("deepseek");
    secrets.aiEnabled = false;
    await expect(testAiConnection(secrets)).resolves.toBe("OK");
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("sends a compact relevant excerpt and caps polish output tokens", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"category":"研究","title":"研究招募","summary":"【研究】参与研究。薪酬：HK$700。截止：未标明。对象：成年人。"}' } }],
    }), { status: 200 }));
    localStorage.setItem("cu-link-secrets-v2", JSON.stringify(makeSecrets("deepseek")));
    const filler = Array.from({ length: 80 }, (_, i) => `一般背景资料第 ${i} 行，不包含关键资料。`).join("\n");
    await aiPolishOpportunity({
      title: "抑郁症研究参与者招募",
      summary: "",
      bodyText: `${filler}\n参与者可获得 HK$700，年龄须为18至65岁。`,
      lang: "zh",
      taxonomyType: "research",
    });
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const userPayload = request.messages[1].content as string;
    expect(userPayload).toContain("HK$700");
    expect(userPayload.length).toBeLessThan(1500);
    expect(request.max_tokens).toBe(220);
  });

  it("keeps relevant facts from later in a long email excerpt", () => {
    const body = `${"普通介绍。\n".repeat(300)}申请截止日期为2026年8月20日，津贴为HK$80每小时。`;
    const excerpt = compactPolishExcerpt("活动助理", "", body);
    expect(excerpt).toContain("2026年8月20日");
    expect(excerpt).toContain("HK$80");
    expect(excerpt.length).toBeLessThanOrEqual(900);
  });

  it.each([
    [401, "AI_AUTH_INVALID", "认证失败"],
    [403, "AI_PERMISSION_DENIED", "请求被拒绝"],
    [404, "AI_MODEL_UNAVAILABLE", "模型不可用"],
    [429, "AI_RATE_LIMITED", "请求过于频繁"],
  ])("maps HTTP %s to a safe error", async (status, code, zhText) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("secret provider detail", { status }));
    const error = await testAiConnection(makeSecrets("deepseek")).then(
      () => new Error("expected failure"),
      err => err as Error,
    );
    expect(error.message).toBe(code);
    expect(aiErrorMessage(error, "zh")).toContain(zhText);
    expect(aiErrorMessage(error, "zh")).not.toContain("secret provider detail");
  });

  it("maps network and malformed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("failed to fetch"));
    const networkError = await testAiConnection(makeSecrets("zhipu")).then(
      () => new Error("expected failure"),
      err => err as Error,
    );
    expect(networkError.message).toBe("AI_NETWORK_ERROR");

    vi.mocked(fetch).mockResolvedValueOnce(new Response("not json", { status: 200 }));
    const responseError = await testAiConnection(makeSecrets("zhipu")).then(
      () => new Error("expected failure"),
      err => err as Error,
    );
    expect(responseError.message).toBe("AI_RESPONSE_INVALID");
  });
});
