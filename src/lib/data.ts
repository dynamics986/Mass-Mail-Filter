import { z } from "zod";
import type { FacultiesFile, FeedMeta, MailItem } from "../types";
import { isPublishedMailItem } from "./sourceLinks";
import { cleanMailText } from "./textCleanup";

const taxonomySchema = z.object({
  type: z.enum(["paid_work", "research", "event", "programme", "competition", "service", "admin"]),
  domains: z.array(z.string()),
  roles: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  evidence: z.string().default(""),
});

const itemSchema = z.object({
  id: z.string(),
  digestDate: z.string(),
  category: z.string(),
  title: z.string(),
  bodyText: z.string(),
  cleanBody: z.string().optional(),
  summary: z.string().default(""),
  summaryEvidence: z.array(z.string()).default([]),
  organizer: z.string().optional(),
  contactEmail: z.string().optional(),
  sourceUrl: z.string(),
  applicationUrls: z.array(z.string()).default([]),
  deadline: z.string().optional(),
  deadlineKind: z.enum(["apply", "event", "rolling", "unknown"]).default("unknown"),
  deadlineConfidence: z.enum(["high", "medium", "low"]).default("low"),
  deadlineEvidence: z.string().default(""),
  timeMarks: z
    .array(
      z.object({
        kind: z.enum([
          "published",
          "apply_deadline",
          "event_point",
          "event_range",
          "project_start",
          "project_end",
          "work_period",
          "rolling",
        ]),
        shape: z.enum(["point", "range", "open"]).default("point"),
        start: z.string().optional(),
        end: z.string().optional(),
        confidence: z.enum(["high", "medium", "low"]).default("medium"),
        evidence: z.string().default(""),
        label: z.string().default(""),
      }),
    )
    .default([]),
  compensation: z
    .object({
      type: z.enum(["cash", "voucher", "allowance", "prize", "unknown"]),
      minHkd: z.number().optional(),
      maxHkd: z.number().optional(),
    })
    .optional(),
  taxonomy: taxonomySchema,
  tags: z.array(z.string()).default([]),
  keyPhrases: z.array(z.string()).default([]),
  requirements: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(["equals", "includes", "min", "max"]),
        value: z.union([z.string(), z.number()]),
        confidence: z.enum(["high", "medium"]),
        evidence: z.string(),
      }),
    )
    .default([]),
  publishedAt: z.string(),
  fetchedAt: z.string(),
  source: z.enum(["digest", "import"]).default("digest"),
});

const metaSchema = z.object({
  latestDigest: z.string(),
  fetchedAt: z.string(),
  itemCount: z.number(),
  status: z.enum(["ok", "stale", "error"]).default("ok"),
  sourceUrl: z.string(),
});

const FEED_CACHE = "cu-link-feed-cache-v2";
const META_CACHE = "cu-link-meta-cache-v2";

export async function loadFeed(): Promise<{ items: MailItem[]; meta: FeedMeta; offline: boolean }> {
  try {
    const [feedRes, metaRes] = await Promise.all([fetch("./data/feed.json"), fetch("./data/meta.json")]);
    if (!feedRes.ok || !metaRes.ok) throw new Error("feed fetch failed");
    const rawItems = await feedRes.json();
    const rawMeta = await metaRes.json();
    const items = (z.array(itemSchema).parse(rawItems) as MailItem[]).filter(isPublishedMailItem).map(cleanMailText);
    const meta = metaSchema.parse(rawMeta) as FeedMeta;
    localStorage.setItem(FEED_CACHE, JSON.stringify(items));
    localStorage.setItem(META_CACHE, JSON.stringify(meta));
    return { items, meta, offline: !navigator.onLine };
  } catch {
    const cachedItems = localStorage.getItem(FEED_CACHE);
    const cachedMeta = localStorage.getItem(META_CACHE);
    if (cachedItems && cachedMeta) {
      return {
        items: (JSON.parse(cachedItems) as MailItem[]).filter(isPublishedMailItem).map(cleanMailText),
        meta: JSON.parse(cachedMeta) as FeedMeta,
        offline: true,
      };
    }
    throw new Error("Unable to load feed");
  }
}

export async function loadFaculties(): Promise<FacultiesFile> {
  const res = await fetch("./data/faculties.json");
  if (!res.ok) throw new Error("faculties missing");
  return (await res.json()) as FacultiesFile;
}

export function getAnnouncementsUrl(digestDate: string): string {
  const compact = digestDate.replaceAll("-", "");
  return `http://cumassmail.itsc.cuhk.edu.hk/weekly/Digest/List/UG/${compact}/Announcements`;
}
