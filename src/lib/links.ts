import type { MailItem } from "../types";

const CUHK_DIGEST_ORIGIN = "http://cumassmail.itsc.cuhk.edu.hk";

export function getCuhkSource(item: MailItem): { url: string | null; direct: boolean } {
  if (/^\d+$/.test(item.id)) {
    const digest = item.digestDate.replaceAll("-", "");
    return {
      url: `${CUHK_DIGEST_ORIGIN}/weekly/Digest/Message/UG/${digest}/${item.id}`,
      direct: true,
    };
  }
  return { url: null, direct: false };
}

export function getAnnouncementsUrl(digestDate: string): string {
  const digest = digestDate.replaceAll("-", "");
  return `${CUHK_DIGEST_ORIGIN}/weekly/Digest/List/UG/${digest}/Announcements`;
}
