import type { LocalState, MailItem } from "../types";

export type ItemFeedback = LocalState["itemFeedback"];
export type FeedbackChoice = ItemFeedback[string];

export function toggleItemFeedback(
  feedback: ItemFeedback,
  itemId: string,
  choice: FeedbackChoice,
): ItemFeedback {
  const next = { ...feedback };
  if (next[itemId] === choice) delete next[itemId];
  else next[itemId] = choice;
  return next;
}

export function categoryFeedback(
  item: MailItem,
  items: MailItem[],
  feedback: ItemFeedback,
): FeedbackChoice | undefined {
  const type = item.taxonomy?.type;
  let balance = 0;
  for (const source of items) {
    if (source.taxonomy?.type !== type) continue;
    if (feedback[source.id] === "more") balance += 1;
    if (feedback[source.id] === "less") balance -= 1;
  }
  return balance > 0 ? "more" : balance < 0 ? "less" : undefined;
}
