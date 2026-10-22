export type Phase =
  | "prepare"
  | "work"
  | "rest"
  | "cycleRest"
  | "cooldown"
  | "complete";

export type TimerConfig = {
  id: string;
  name: string;
  prepareSec: number;
  workSec: number;
  restSec: number;
  rounds: number;
  cycles: number;
  cycleRestSec: number;
  cooldownSec: number;
};

export type Segment = {
  phase: Phase;
  durationSec: number;
  round: number;
  cycle: number;
  rounds: number;
  cycles: number;
};

export type Limit = { min: number; max: number; step: number };

export const LIMITS = {
  prepareSec: { min: 0, max: 30 * 60, step: 5 },
  workSec: { min: 1, max: 60 * 60, step: 5 },
  restSec: { min: 0, max: 30 * 60, step: 5 },
  rounds: { min: 1, max: 99, step: 1 },
  cycles: { min: 1, max: 99, step: 1 },
  cycleRestSec: { min: 0, max: 30 * 60, step: 5 },
  cooldownSec: { min: 0, max: 30 * 60, step: 5 },
} as const;

export type ConfigKey = keyof typeof LIMITS;

export const PHASE_LABEL: Record<Phase, string> = {
  prepare: "準備",
  work: "鍛鍊",
  rest: "休息",
  cycleRest: "循環休息",
  cooldown: "冷卻",
  complete: "完成",
};

export const PHASE_EN: Record<Phase, string> = {
  prepare: "PREPARE",
  work: "WORK",
  rest: "REST",
  cycleRest: "RECOVER",
  cooldown: "COOL DOWN",
  complete: "DONE",
};
