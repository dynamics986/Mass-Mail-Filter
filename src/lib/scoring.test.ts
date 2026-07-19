import { describe, expect, it } from "vitest";
import { evaluateItem, isClosingSoon, relativeDeadline } from "./scoring";
import { defaultProfile } from "./storage";
import type { MailItem } from "../types";

const baseItem: MailItem = {
  id: "1",
  digestDate: "2026-07-17",
  category: "Announcements",
  title: "Student Helpers Recruitment (HK$64/hr)",
  bodyText: "Hourly Rate: HK$64. Apply by 2026-08-01.",
  cleanBody: "Hourly Rate: HK$64. Apply by 2026-08-01.",
  summary: "Recruiting student helpers at HK$64/hr for on-site events.",
  summaryEvidence: ["Recruiting student helpers at HK$64/hr for on-site events."],
  sourceUrl: "http://example.com/1",
  applicationUrls: [],
  deadline: "2099-08-01",
  deadlineKind: "apply",
  deadlineConfidence: "high",
  deadlineEvidence: "Apply by 2099-08-01",
  timeMarks: [
    { kind: "published", shape: "point", start: "2026-07-17", confidence: "high", evidence: "digest", label: "Published" },
    { kind: "apply_deadline", shape: "point", start: "2099-08-01", confidence: "high", evidence: "Apply by", label: "Apply by" },
  ],
  compensation: { type: "cash", minHkd: 64, maxHkd: 64 },
  taxonomy: {
    type: "paid_work",
    domains: ["Education"],
    roles: ["helper"],
    confidence: "high",
    evidence: "student helper",
  },
  tags: ["Paid work", "Education", "helper"],
  keyPhrases: ["student helpers"],
  requirements: [],
  publishedAt: "2026-07-17T00:00:00+08:00",
  fetchedAt: "2026-07-17T00:00:00Z",
};

describe("evaluateItem", () => {
  it("scores paid helper highly on value and fit for paid goal", () => {
    const profile = {
      ...defaultProfile,
      facultyId: "education",
      year: "Y3" as const,
      goals: ["paid" as const],
      onboarded: true,
    };
    const ev = evaluateItem(baseItem, profile);
    expect(ev.scores.value).toBeGreaterThan(60);
    expect(ev.scores.fit).toBeGreaterThan(50);
    expect(ev.score).toBeGreaterThan(40);
    expect(ev.eligibility).toBe("unknown");
  });

  it("uses the paid-work goal as the value preference", () => {
    const paid = evaluateItem(baseItem, { ...defaultProfile, goals: ["paid"] });
    const noPaid = evaluateItem(baseItem, { ...defaultProfile, goals: ["research"] });
    expect(paid.scores.value).toBeGreaterThan(noPaid.scores.value);
  });

  it("marks language conflict as ineligible", () => {
    const item: MailItem = {
      ...baseItem,
      requirements: [
        {
          field: "nativeLanguage",
          operator: "equals",
          value: "English",
          confidence: "high",
          evidence: "native English speakers",
        },
      ],
    };
    const profile = { ...defaultProfile, nativeLanguages: ["Cantonese"], spokenLanguages: ["Cantonese"] };
    const ev = evaluateItem(item, profile);
    expect(ev.eligibility).toBe("ineligible");
    expect(ev.scores.fit).toBe(0);
  });

  it("treats missing apply deadline as neutral urgency", () => {
    const item = { ...baseItem, deadline: undefined, deadlineKind: "unknown" as const };
    const ev = evaluateItem(item, defaultProfile);
    expect(ev.scores.urgent).toBe(28);
  });
});

describe("deadline helpers", () => {
  it("detects closing soon", () => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    expect(isClosingSoon({ ...baseItem, deadline: soon })).toBe(true);
  });

  it("formats relative deadline", () => {
    expect(relativeDeadline({ ...baseItem, deadlineKind: "rolling" }, "zh")).toContain("滚动");
  });
});
