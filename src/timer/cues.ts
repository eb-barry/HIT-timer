import type { Phase } from "./types";

export type BeepKind = "tick" | "high" | "low" | "calm" | "done";

export type SecondCue =
  | { kind: "count"; n: 1 | 2 | 3 }
  | { kind: "beep"; beep: BeepKind };

/**
 * Cues for a displayed second inside a phase.
 * The opening second belongs to the phase announcement, so a 3 second
 * phase says its name instead of「三」.
 * Prepare ticks every remaining second. Longer phases stay quiet until
 * the final three seconds.
 */
export function secondCues(
  phase: Phase,
  durationSec: number,
  displaySec: number,
): SecondCue[] {
  if (phase === "complete" || displaySec <= 0 || displaySec === durationSec) return [];
  if (displaySec <= 3) {
    return [
      { kind: "count", n: displaySec as 1 | 2 | 3 },
      { kind: "beep", beep: "tick" },
    ];
  }
  if (phase === "prepare") return [{ kind: "beep", beep: "tick" }];
  return [];
}

export function phaseBeep(phase: Phase): BeepKind {
  switch (phase) {
    case "prepare":
      return "tick";
    case "work":
      return "high";
    case "rest":
    case "cycleRest":
      return "low";
    case "cooldown":
      return "calm";
    case "complete":
      return "done";
  }
}

export function phaseVibration(phase: Phase): number[] {
  switch (phase) {
    case "work":
      return [35, 45, 35];
    case "rest":
    case "cycleRest":
      return [80];
    case "complete":
      return [30, 40, 30, 40, 90];
    case "prepare":
      return [20];
    case "cooldown":
      return [45];
  }
}

export const COUNT_VIBRATION = [16];

export const COUNT_WORD = ["", "一", "二", "三"] as const;
