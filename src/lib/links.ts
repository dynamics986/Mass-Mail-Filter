import type { MailItem } from "../types";

const DETAIL_PATTERN = /\/weekly\/Digest\/Message\/UG\/\d{8}\/\d+\/?$/i;

export function getCuhkSource(item: MailItem): { url: string; direct: boolean } {
  if (DETAIL_PATTERN.test(item.sourceUrl)) return { url: item.sourceUrl, direct: true };
  if (/^\d+$/.test(item.id)) {
    const digest = item.digestDate.replaceAll("-", "");
    return {
      url: `https://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/Message/UG/${digest}/${item.id}`,
      direct: true,
    };
  }
  return { url: item.sourceUrl, direct: false };
}
