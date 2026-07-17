import { z } from "zod";

const requirementSchema = z.object({ field: z.enum(["studentLevel", "major", "nativeLanguage", "spokenLanguage", "age", "gender", "residency", "health", "skill"]), operator: z.enum(["equals", "includes", "min", "max"]), value: z.union([z.string(), z.number()]), confidence: z.enum(["high", "medium"]), evidence: z.string() });
const optionalString = z.string().nullish().transform(value => value ?? undefined);
const optionalNumber = z.number().nullish().transform(value => value ?? undefined);
const compensationSchema = z.object({ type: z.enum(["cash", "voucher", "allowance", "prize", "unknown"]), minHkd: optionalNumber, maxHkd: optionalNumber }).nullish().transform(value => value ?? undefined);
export const mailItemSchema = z.object({ id: z.string(), digestDate: z.string(), category: z.string(), title: z.string(), bodyText: z.string(), organizer: optionalString, contactEmail: optionalString, sourceUrl: z.string().url(), applicationUrls: z.array(z.string().url()), deadline: optionalString, compensation: compensationSchema, tags: z.array(z.string()), requirements: z.array(requirementSchema), publishedAt: z.string(), fetchedAt: z.string() });
export const feedSchema = z.array(mailItemSchema);
export const metaSchema = z.object({ latestDigest: z.string(), fetchedAt: z.string(), itemCount: z.number(), status: z.enum(["ok", "stale", "error"]), sourceUrl: z.string().url() });
