import { describe, expect, it } from "vitest";
import { evaluateItem } from "./ranking";
import { defaultProfile } from "./storage";
import type { MailItem } from "../types";

const base: MailItem = { id: "1", digestDate: "2026-07-10", category: "Announcements", title: "Paid AI Web Student Helper", bodyText: "HK$300 data analysis work", sourceUrl: "https://example.com", applicationUrls: [], tags: ["AI", "Web", "Student helper"], requirements: [], publishedAt: "2026-07-10T00:00:00+08:00", fetchedAt: "2026-07-10T01:00:00Z" };
describe("ranking", () => {
  it("ranks paid engineering student work highly and explains it", () => { const result = evaluateItem(base, defaultProfile); expect(result.score).toBeGreaterThanOrEqual(75); expect(result.reasons.map(r => r.key)).toContain("engineering"); });
  it("does not treat spoken Cantonese as native Cantonese", () => { const item = { ...base, requirements: [{ field: "nativeLanguage" as const, operator: "equals" as const, value: "Cantonese", confidence: "high" as const, evidence: "native Cantonese speakers" }] }; expect(evaluateItem(item, defaultProfile).eligibility).toBe("ineligible"); });
  it("keeps missing profile facts unknown", () => { const item = { ...base, requirements: [{ field: "age" as const, operator: "min" as const, value: 18, confidence: "high" as const, evidence: "aged 18+" }] }; expect(evaluateItem(item, defaultProfile).eligibility).toBe("unknown"); });
});
