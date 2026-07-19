import { describe, expect, it } from "vitest";
import { toggleItemFeedback } from "./feedback";

describe("item feedback", () => {
  it("toggles the same choice off", () => {
    const selected = toggleItemFeedback({}, "mail-1", "less");
    expect(selected).toEqual({ "mail-1": "less" });
    expect(toggleItemFeedback(selected, "mail-1", "less")).toEqual({});
  });

  it("switches mutually exclusively between less and more", () => {
    const less = toggleItemFeedback({}, "mail-1", "less");
    const more = toggleItemFeedback(less, "mail-1", "more");
    expect(more).toEqual({ "mail-1": "more" });
    expect(toggleItemFeedback(more, "mail-1", "less")).toEqual({ "mail-1": "less" });
  });
});
