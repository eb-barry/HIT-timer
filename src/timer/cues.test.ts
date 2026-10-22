import { describe, expect, it } from "vitest";
import { phaseBeep, secondCues } from "./cues";

describe("secondCues", () => {
  it("ticks through prepare and speaks only the last three seconds", () => {
    expect(secondCues("prepare", 5, 5)).toEqual([]);
    expect(secondCues("prepare", 5, 4)).toEqual([{ kind: "beep", beep: "tick" }]);
    expect(secondCues("prepare", 5, 3)).toEqual([
      { kind: "count", n: 3 },
      { kind: "beep", beep: "tick" },
    ]);
    expect(secondCues("prepare", 5, 1)).toEqual([
      { kind: "count", n: 1 },
      { kind: "beep", beep: "tick" },
    ]);
  });

  it("keeps the middle of a work interval quiet", () => {
    expect(secondCues("work", 30, 30)).toEqual([]);
    expect(secondCues("work", 30, 15)).toEqual([]);
    expect(secondCues("work", 30, 3)[0]).toEqual({ kind: "count", n: 3 });
  });

  it("lets the phase name win when the interval is only three seconds", () => {
    expect(secondCues("work", 3, 3)).toEqual([]);
    expect(secondCues("work", 3, 2)[0]).toEqual({ kind: "count", n: 2 });
  });

  it("gives work and rest different beeps", () => {
    expect(phaseBeep("work")).toBe("high");
    expect(phaseBeep("rest")).toBe("low");
    expect(phaseBeep("cycleRest")).toBe("low");
    expect(phaseBeep("complete")).toBe("done");
  });
});
