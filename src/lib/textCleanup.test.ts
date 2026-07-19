import { describe, expect, it } from "vitest";
import { nonRedundantSummary, stripDecorativeEmoji } from "./textCleanup";

describe("mail text cleanup", () => {
  it("removes decorative emoji sequences and normalizes spacing", () => {
    expect(stripDecorativeEmoji("📢 💰 招募粵語參加者 👩🏻‍🎓 👏🏻 HK$700"))
      .toBe("招募粵語參加者 HK$700");
  });

  it("keeps Chinese, English, currency, dates and punctuation", () => {
    expect(stripDecorativeEmoji("研究助理：HK$64/小時（8月20日截止）"))
      .toBe("研究助理：HK$64/小時（8月20日截止）");
  });

  it("hides summaries that only repeat the title and organizer", () => {
    const title = "Recruiting Post-Menopausal Women for an Exercise Study";
    expect(nonRedundantSummary(title, `${title} – Department of Sports Science`)).toBeUndefined();
    expect(nonRedundantSummary(title, "Participants receive HK$4,200 after completing the study."))
      .toBe("Participants receive HK$4,200 after completing the study.");
  });

  it("hides a truncated middle section copied from a long bilingual title", () => {
    const title = "(Earn $700!!!) Recruiting adults aged 18–65 who have recovered from depression to participate in a study on depression recurrence (participants on medication are welcome if condition is medically stable) (獲得 $700!!!) 誠邀抑鬱症康復者參與研究";
    const copied = ") Recruiting adults aged 18–65 who have recovered from depression to participate in a study on depression recurrence (participants on medication are welcome if condition is medically stable) (獲得 $700!!!";
    expect(nonRedundantSummary(title, copied)).toBeUndefined();
  });

  it("keeps a summary that adds a genuine team introduction", () => {
    const title = "招募聽力損失長者及其孫子女參與互動實驗";
    const summary = "我們是香港中文大學大腦與認知研究所（BMI）的研究團隊。我們團隊誠摯邀請有聽力損失的長者及其孫子女來參與一項互動研究。";
    expect(nonRedundantSummary(title, summary)).toBe(summary);
  });
});
