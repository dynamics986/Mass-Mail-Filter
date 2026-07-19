import { beforeEach, describe, expect, it } from "vitest";
import { defaultState, loadState, saveState } from "./storage";

describe("profile storage migration", () => {
  beforeEach(() => localStorage.clear());

  it("moves legacy preferPaid into the paid-work goal and drops the old field", () => {
    localStorage.setItem("cu-link-state-v2", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, goals: ["research"], preferPaid: true },
    }));

    const state = loadState();
    expect(state.profile.goals).toContain("paid");
    expect(state.profile).not.toHaveProperty("preferPaid");

    saveState(state);
    expect(JSON.parse(localStorage.getItem("cu-link-state-v2")!).profile).not.toHaveProperty("preferPaid");
  });
});
