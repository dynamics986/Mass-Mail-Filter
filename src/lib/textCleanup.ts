import type { MailItem } from "../types";

const EMOJI_SEQUENCE = /\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})?)*/gu;
const FLAGS = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
const EMOJI_MARKS = /[\u200D\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/gu;

export function stripDecorativeEmoji(value: string): string {
  return value
    .replace(FLAGS, "")
    .replace(EMOJI_SEQUENCE, "")
    .replace(EMOJI_MARKS, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function comparable(value: string): string {
  return value.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
}

export function nonRedundantSummary(title: string, summary: string | undefined): string | undefined {
  const cleanSummary = summary?.trim();
  if (!cleanSummary) return undefined;
  const titleKey = comparable(title);
  const summaryKey = comparable(cleanSummary);
  if (!titleKey || !summaryKey) return cleanSummary;
  // Extractive summaries sometimes capture a long, truncated portion from the
  // middle of a bilingual title. Containment in either direction is repetition.
  if (summaryKey.includes(titleKey)) return undefined;
  if (summaryKey.length >= 40 && titleKey.includes(summaryKey)) return undefined;
  return cleanSummary;
}

export function cleanMailText(item: MailItem): MailItem {
  return {
    ...item,
    title: stripDecorativeEmoji(item.title),
    summary: stripDecorativeEmoji(item.summary),
    bodyText: stripDecorativeEmoji(item.bodyText),
    cleanBody: item.cleanBody ? stripDecorativeEmoji(item.cleanBody) : item.cleanBody,
  };
}
