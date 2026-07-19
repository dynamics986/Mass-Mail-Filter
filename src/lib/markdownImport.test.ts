import { describe, expect, it } from "vitest";
import { EXPORT_TEMPLATE, parseCuLinkMarkdown } from "./markdownImport";

describe("parseCuLinkMarkdown", () => {
  it("parses the OpenClaw template into mail items with time marks", () => {
    const items = parseCuLinkMarkdown(EXPORT_TEMPLATE);
    expect(items.length).toBe(2);
    expect(items[0].title).toMatch(/Student Helper/);
    expect(items[0].deadline).toBe("2026-08-20");
    expect(items[0].timeMarks?.some(m => m.kind === "event_range")).toBe(true);
    expect(items[0].source).toBe("import");
    expect(items[1].timeMarks?.some(m => m.kind === "work_period")).toBe(true);
  });

  it("rejects unrelated markdown", () => {
    expect(() => parseCuLinkMarkdown("# Hello\n\nNo items")).toThrow(/CU Link mail export/i);
  });
});
