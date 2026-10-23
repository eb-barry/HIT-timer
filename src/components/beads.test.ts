import { describe, expect, it } from "vitest";
import { beadPath, beadSpans, beadStates } from "./beads";

describe("progress beads", () => {
  it("lights only the top bead at the start, then completed beads stay lit", () => {
    expect(beadStates(10, 1, false)).toEqual([
      "current",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(beadStates(10, 3, false).slice(0, 4)).toEqual(["done", "done", "current", "future"]);
  });

  it("lights every bead when the workout is complete and keeps a single cycle as one bead", () => {
    expect(beadStates(10, 10, true).every((state) => state === "done")).toBe(true);
    expect(beadStates(1, 1, false)).toEqual(["current"]);
    expect(beadStates(1, 1, true)).toEqual(["done"]);
  });

  it("centers the first bead at 12 o'clock and keeps a gap through 99", () => {
    const ten = beadSpans(10);
    expect(ten).toHaveLength(10);
    expect((ten[0].start + ten[0].end) / 2).toBeCloseTo(0, 5);
    expect(ten[1].start - ten[0].end).toBeCloseTo(0.08, 5);
    expect(ten[0].end).toBeGreaterThan(ten[0].start);

    const many = beadSpans(99);
    expect(many).toHaveLength(99);
    for (const span of many) {
      expect(span.end - span.start).toBeGreaterThan(0.02);
      expect(beadPath(span.start, span.end).startsWith("M ")).toBe(true);
    }
    const only = beadSpans(1)[0];
    expect(only.end - only.start).toBeGreaterThan(Math.PI * 1.8);
    expect(beadPath(only.start, only.end)).toContain("Z");
  });
});
