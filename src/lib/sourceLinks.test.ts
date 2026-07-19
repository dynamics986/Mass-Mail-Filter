import { describe, expect, it } from "vitest";
import { getOriginalSourceUrl, isPublishedMailItem, isUsableSourceUrl } from "./sourceLinks";
import type { MailItem } from "../types";

describe("source links", () => {
  it("accepts real CUHK message URLs", () => {
    expect(isUsableSourceUrl("http://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260717/100590")).toBe(true);
  });

  it.each([
    "http://example.com/sample-ra",
    "https://www.example.com/message",
    "local://import/mail-1",
    "not a URL",
    "",
  ])("rejects placeholder or non-web URL %s", value => {
    expect(isUsableSourceUrl(value)).toBe(false);
  });

  it("rejects sample feed items even if they contain a web URL", () => {
    const item = {
      id: "sample-ra",
      sourceUrl: "https://cuhk.edu.hk/example",
    } as MailItem;
    expect(isPublishedMailItem(item)).toBe(false);
  });

  it("constructs the canonical CUHK page from the digest date and numeric message ID", () => {
    const item = {
      id: "100590",
      digestDate: "2026-07-17",
      sourceUrl: "http://example.com/wrong",
    } as MailItem;
    expect(getOriginalSourceUrl(item)).toBe(
      "http://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/20260717/100590",
    );
  });

  it("uses a valid imported source but never a placeholder", () => {
    expect(getOriginalSourceUrl({ id: "import-1", sourceUrl: "https://department.cuhk.edu.hk/mail/1" } as MailItem))
      .toBe("https://department.cuhk.edu.hk/mail/1");
    expect(getOriginalSourceUrl({ id: "sample-ra", sourceUrl: "http://example.com/sample-ra" } as MailItem))
      .toBeNull();
  });
});
