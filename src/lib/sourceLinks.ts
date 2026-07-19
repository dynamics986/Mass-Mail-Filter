import type { MailItem } from "../types";

const PLACEHOLDER_HOSTS = new Set(["example.com", "www.example.com"]);
const CUHK_DIGEST_ORIGIN = "http://cumassmail.itsc.cuhk.edu.hk";

export function isUsableSourceUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !PLACEHOLDER_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isPublishedMailItem(item: MailItem): boolean {
  return /^\d+$/.test(item.id) && !!item.digestDate;
}

export function getOriginalSourceUrl(item: MailItem): string | null {
  if (/^\d+$/.test(item.id) && item.digestDate) {
    const digest = item.digestDate.replaceAll("-", "");
    return `${CUHK_DIGEST_ORIGIN}/weekly/Digest/Message/UG/${digest}/${item.id}`;
  }
  return isUsableSourceUrl(item.sourceUrl) ? item.sourceUrl : null;
}
