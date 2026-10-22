import { clamp } from "./format";
import { LIMITS, type ConfigKey, type Phase, type Segment, type TimerConfig } from "./types";

function cleanInt(value: number, key: ConfigKey): number {
  const limit = LIMITS[key];
  if (!Number.isFinite(value)) return limit.min;
  return clamp(Math.round(value), limit.min, limit.max);
}

export function sanitizeConfig(input: TimerConfig): TimerConfig {
  const name = input.name.trim().slice(0, 24) || "未命名";
  return {
    id: input.id || "preset",
    name,
    prepareSec: cleanInt(input.prepareSec, "prepareSec"),
    workSec: cleanInt(input.workSec, "workSec"),
    restSec: cleanInt(input.restSec, "restSec"),
    rounds: cleanInt(input.rounds, "rounds"),
    cycles: cleanInt(input.cycles, "cycles"),
    cycleRestSec: cleanInt(input.cycleRestSec, "cycleRestSec"),
    cooldownSec: cleanInt(input.cooldownSec, "cooldownSec"),
  };
}

/**
 * A round is work plus the short rest, except the last round of a cycle.
 * That last round is replaced by the rest between cycles, or by cooldown
 * when the workout is ending. A zero-length replacement is skipped.
 */
export function buildSegments(config: TimerConfig): Segment[] {
  const plan = sanitizeConfig(config);
  const segments: Segment[] = [];
  const push = (phase: Phase, durationSec: number, round: number, cycle: number) => {
    segments.push({
      phase,
      durationSec,
      round,
      cycle,
      rounds: plan.rounds,
      cycles: plan.cycles,
    });
  };

  if (plan.prepareSec > 0) push("prepare", plan.prepareSec, 1, 1);

  for (let cycle = 1; cycle <= plan.cycles; cycle += 1) {
    const lastCycle = cycle === plan.cycles;
    for (let round = 1; round <= plan.rounds; round += 1) {
      const lastRound = round === plan.rounds;
      push("work", plan.workSec, round, cycle);
      if (!lastRound) {
        if (plan.restSec > 0) push("rest", plan.restSec, round, cycle);
        continue;
      }
      if (!lastCycle) {
        if (plan.cycleRestSec > 0) push("cycleRest", plan.cycleRestSec, round, cycle);
        continue;
      }
      if (plan.cooldownSec > 0) push("cooldown", plan.cooldownSec, round, cycle);
    }
  }

  push("complete", 0, plan.rounds, plan.cycles);
  return segments;
}

export function totalDurationSec(segments: Segment[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationSec, 0);
}

export function briefSummary(config: TimerConfig): string {
  const plan = sanitizeConfig(config);
  return `${plan.workSec} 秒鍛鍊 · ${plan.restSec} 秒休息 × ${plan.rounds} · ${plan.cycles} 循環`;
}

export function planSummary(config: TimerConfig): string {
  const plan = sanitizeConfig(config);
  const parts: string[] = [];
  if (plan.prepareSec > 0) parts.push(`準備 ${plan.prepareSec} 秒`);
  parts.push(`鍛鍊 ${plan.workSec} 秒`);
  if (plan.restSec > 0) parts.push(`休息 ${plan.restSec} 秒`);
  parts.push(`${plan.rounds} 週期`);
  parts.push(`${plan.cycles} 循環`);
  if (plan.cycles > 1 && plan.cycleRestSec > 0) {
    parts.push(`循環間休息 ${plan.cycleRestSec} 秒`);
  }
  if (plan.cooldownSec > 0) parts.push(`冷卻 ${plan.cooldownSec} 秒`);
  return parts.join(" · ");
}

export const DEFAULT_PRESET: TimerConfig = {
  id: "hiit-classic",
  name: "高強度間歇訓練",
  prepareSec: 5,
  workSec: 30,
  restSec: 10,
  rounds: 10,
  cycles: 3,
  cycleRestSec: 30,
  cooldownSec: 30,
};

export const TABATA_PRESET: TimerConfig = {
  id: "tabata",
  name: "Tabata",
  prepareSec: 5,
  workSec: 20,
  restSec: 10,
  rounds: 8,
  cycles: 1,
  cycleRestSec: 0,
  cooldownSec: 0,
};
