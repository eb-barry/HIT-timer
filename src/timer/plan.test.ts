import { describe, expect, it } from "vitest";
import { formatClock } from "./format";
import {
  DEFAULT_PRESET,
  TABATA_PRESET,
  buildSegments,
  planSummary,
  sanitizeConfig,
  totalDurationSec,
} from "./plan";
import type { TimerConfig } from "./types";

function tiny(overrides: Partial<TimerConfig> = {}): TimerConfig {
  return sanitizeConfig({
    ...DEFAULT_PRESET,
    id: "tiny",
    prepareSec: 0,
    workSec: 30,
    restSec: 10,
    rounds: 2,
    cycles: 2,
    cycleRestSec: 15,
    cooldownSec: 20,
    ...overrides,
  });
}

describe("buildSegments", () => {
  it("builds the default shoreline session as 21:05", () => {
    const segments = buildSegments(DEFAULT_PRESET);
    expect(totalDurationSec(segments)).toBe(21 * 60 + 5);
    expect(formatClock(totalDurationSec(segments))).toBe("21:05");

    const phases = segments.map((segment) => segment.phase);
    expect(phases.filter((phase) => phase === "work")).toHaveLength(30);
    expect(phases.filter((phase) => phase === "rest")).toHaveLength(27);
    expect(phases.filter((phase) => phase === "cycleRest")).toHaveLength(2);
    expect(phases.filter((phase) => phase === "cooldown")).toHaveLength(1);
    expect(phases.at(-1)).toBe("complete");
    expect(phases[0]).toBe("prepare");
  });

  it("replaces the last round of a cycle with cycle rest, then cooldown", () => {
    const phases = buildSegments(tiny()).map((segment) => `${segment.phase}:${segment.durationSec}`);
    expect(phases).toEqual([
      "work:30",
      "rest:10",
      "work:30",
      "cycleRest:15",
      "work:30",
      "rest:10",
      "work:30",
      "cooldown:20",
      "complete:0",
    ]);
  });

  it("skips a zero-length cycle rest and cooldown", () => {
    const phases = buildSegments(
      tiny({ cycles: 2, rounds: 2, cycleRestSec: 0, cooldownSec: 0, restSec: 10 }),
    ).map((segment) => segment.phase);
    expect(phases).toEqual(["work", "rest", "work", "work", "rest", "work", "complete"]);
  });

  it("builds Tabata without a trailing rest", () => {
    const segments = buildSegments(TABATA_PRESET);
    expect(totalDurationSec(segments)).toBe(5 + 8 * 20 + 7 * 10);
    const phases = segments.map((segment) => segment.phase);
    expect(phases.filter((phase) => phase === "rest")).toHaveLength(7);
    expect(phases).not.toContain("cycleRest");
    expect(phases).not.toContain("cooldown");
  });

  it("rejects an empty name and a zero work interval", () => {
    const config = sanitizeConfig({ ...DEFAULT_PRESET, name: "   ", workSec: 0, rounds: 0 });
    expect(config.name).toBe("未命名");
    expect(config.workSec).toBe(1);
    expect(config.rounds).toBe(1);
  });

  it("summarizes the intervals in one line", () => {
    expect(planSummary(DEFAULT_PRESET)).toContain("冷卻 30 秒");
    expect(planSummary(TABATA_PRESET)).not.toContain("冷卻");
  });
});
