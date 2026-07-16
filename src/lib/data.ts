import { feedSchema, metaSchema } from "../schema";
import type { FeedMeta, MailItem } from "../types";

const FEED_CACHE = "cu-link-feed-cache", META_CACHE = "cu-link-meta-cache";
export async function loadFeed(): Promise<{ items: MailItem[]; meta: FeedMeta; offline: boolean }> {
  try {
    const [feedRes, metaRes] = await Promise.all([fetch("./data/feed.json", { cache: "no-store" }), fetch("./data/meta.json", { cache: "no-store" })]);
    if (!feedRes.ok || !metaRes.ok) throw new Error("Feed unavailable");
    const items = feedSchema.parse(await feedRes.json()) as MailItem[];
    const meta = metaSchema.parse(await metaRes.json()) as FeedMeta;
    localStorage.setItem(FEED_CACHE, JSON.stringify(items)); localStorage.setItem(META_CACHE, JSON.stringify(meta));
    return { items, meta, offline: false };
  } catch (error) {
    const cachedFeed = localStorage.getItem(FEED_CACHE), cachedMeta = localStorage.getItem(META_CACHE);
    if (!cachedFeed || !cachedMeta) throw error;
    return { items: feedSchema.parse(JSON.parse(cachedFeed)) as MailItem[], meta: metaSchema.parse(JSON.parse(cachedMeta)) as FeedMeta, offline: true };
  }
}
