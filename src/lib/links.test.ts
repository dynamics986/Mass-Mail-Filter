import { describe, expect, it } from "vitest";
import { getCuhkSource } from "./links";
import type { MailItem } from "../types";

const item = (id: string, sourceUrl: string): MailItem => ({
  id, digestDate: "2026-07-10", category: "Announcements", title: "Test", bodyText: "Test body",
  sourceUrl, applicationUrls: [], tags: [], requirements: [], publishedAt: "2026-07-10T00:00:00+08:00", fetchedAt: "2026-07-10T01:00:00Z",
});

describe("CUHK source links", () => {
  it("constructs the canonical detail URL from date and numeric message ID", () => {
    expect(getCuhkSource(item("101234", "https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/List/UG/20260710"))).toEqual({
      url: "https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260710/101234", direct: true,
    });
  });
  it("preserves an existing detail URL", () => {
    const url = "https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260710/101234";
    expect(getCuhkSource(item("101234", url))).toEqual({ url, direct: true });
  });
  it("labels placeholder data as a digest fallback", () => {
    const url = "https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/List/UG/20260710";
    expect(getCuhkSource(item("sample-item", url))).toEqual({ url, direct: false });
  });
});
