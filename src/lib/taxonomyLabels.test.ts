import { describe, expect, it } from "vitest";
import { tagLabel, taxonomyLabel } from "./taxonomyLabels";

describe("localized structured labels", () => {
  it("renders taxonomy in the selected interface language", () => {
    expect(taxonomyLabel("paid_work", "zh")).toBe("有薪工作");
    expect(taxonomyLabel("paid_work", "en")).toBe("Paid work");
  });

  it("renders common feed tags in the selected interface language", () => {
    expect(tagLabel("applicant", "zh")).toBe("招募对象");
    expect(tagLabel("SocialScience", "zh")).toBe("社会科学");
    expect(tagLabel("Medicine", "en")).toBe("Medicine");
  });

  it("preserves unknown source terms as proper content", () => {
    expect(tagLabel("CUHK", "zh")).toBe("CUHK");
  });
});
