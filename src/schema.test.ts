import { describe, expect, it } from "vitest";
import { feedSchema } from "./schema";

describe("feed schema", () => {
  it("normalizes nullable scraper fields to optional values", () => {
    const [item] = feedSchema.parse([{
      id: "100281",
      digestDate: "2026-07-10",
      category: "Announcements",
      title: "Test opportunity",
      bodyText: "Test body",
      organizer: null,
      contactEmail: null,
      sourceUrl: "http://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260710/100281",
      applicationUrls: [],
      deadline: null,
      compensation: { type: "cash", minHkd: null, maxHkd: 500 },
      tags: [],
      requirements: [],
      publishedAt: "2026-07-10T00:00:00+08:00",
      fetchedAt: "2026-07-17T06:44:27Z",
    }]);

    expect(item.deadline).toBeUndefined();
    expect(item.organizer).toBeUndefined();
    expect(item.compensation?.minHkd).toBeUndefined();
    expect(item.compensation?.maxHkd).toBe(500);
  });

  it("accepts a null compensation value", () => {
    const [item] = feedSchema.parse([{
      id: "100282",
      digestDate: "2026-07-10",
      category: "Announcements",
      title: "Test opportunity",
      bodyText: "Test body",
      sourceUrl: "http://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260710/100282",
      applicationUrls: [],
      deadline: null,
      compensation: null,
      tags: [],
      requirements: [],
      publishedAt: "2026-07-10T00:00:00+08:00",
      fetchedAt: "2026-07-17T06:44:27Z",
    }]);

    expect(item.compensation).toBeUndefined();
  });
});
