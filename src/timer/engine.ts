import { totalDurationSec } from "./plan";
import { PHASE_LABEL, type Phase, type Segment } from "./types";
import { formatClock } from "./format";

export type TimerStatus = "idle" | "running" | "paused" | "complete";

export type TimerState = {
  status: TimerStatus;
  segments: Segment[];
  index: number;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  displaySec: number;
};

export type TimerEffect =
  | { type: "announce"; phase: Phase }
  | { type: "second"; phase: Phase; displaySec: number; durationSec: number };

export type TimerAction =
  | { type: "start"; now: number; segments: Segment[] }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "reset"; segments: Segment[] }
  | { type: "skip"; now: number }
  | { type: "tick"; now: number };

const NATURAL_MS = 300;

export function createIdle(segments: Segment[]): TimerState {
  const first = segments[0];
  const empty = !first || first.phase === "complete" || first.durationSec <= 0;
  return {
    status: empty ? "complete" : "idle",
    segments,
    index: 0,
    phaseEndsAt: null,
    pausedRemainingMs: null,
    displaySec: empty ? 0 : first.durationSec,
  };
}

export function reduce(
  state: TimerState,
  action: TimerAction,
): { state: TimerState; effects: TimerEffect[] } {
  switch (action.type) {
    case "start":
      return start(action.now, action.segments);
    case "pause":
      return pause(state, action.now);
    case "resume":
      return resume(state, action.now);
    case "reset":
      return { state: createIdle(action.segments), effects: [] };
    case "skip":
      return skip(state, action.now);
    case "tick":
      return tick(state, action.now);
  }
}

function start(now: number, segments: Segment[]): { state: TimerState; effects: TimerEffect[] } {
  const idle = createIdle(segments);
  const segment = idle.segments[0];
  if (!segment || segment.phase === "complete" || segment.durationSec <= 0) {
    return {
      state: { ...idle, status: "complete", displaySec: 0 },
      effects: [{ type: "announce", phase: "complete" }],
    };
  }
  return {
    state: {
      ...idle,
      status: "running",
      phaseEndsAt: now + segment.durationSec * 1000,
      displaySec: segment.durationSec,
    },
    effects: [{ type: "announce", phase: segment.phase }],
  };
}

function pause(state: TimerState, now: number): { state: TimerState; effects: TimerEffect[] } {
  if (state.status !== "running" || state.phaseEndsAt == null) return { state, effects: [] };
  return {
    state: {
      ...state,
      status: "paused",
      pausedRemainingMs: Math.max(0, state.phaseEndsAt - now),
    },
    effects: [],
  };
}

function resume(state: TimerState, now: number): { state: TimerState; effects: TimerEffect[] } {
  if (state.status !== "paused" || state.pausedRemainingMs == null) return { state, effects: [] };
  return {
    state: {
      ...state,
      status: "running",
      phaseEndsAt: now + state.pausedRemainingMs,
      pausedRemainingMs: null,
    },
    effects: [],
  };
}

function skip(state: TimerState, now: number): { state: TimerState; effects: TimerEffect[] } {
  if (state.status !== "running" && state.status !== "paused") return { state, effects: [] };
  return enterIndex(state, state.index + 1, now);
}

function enterIndex(
  state: TimerState,
  index: number,
  startedAt: number,
): { state: TimerState; effects: TimerEffect[] } {
  const segment = state.segments[index];
  if (!segment || segment.phase === "complete" || segment.durationSec <= 0) {
    return {
      state: {
        ...state,
        status: "complete",
        index: segment ? index : state.index,
        phaseEndsAt: startedAt,
        pausedRemainingMs: null,
        displaySec: 0,
      },
      effects: [{ type: "announce", phase: "complete" }],
    };
  }
  return {
    state: {
      ...state,
      status: "running",
      index,
      phaseEndsAt: startedAt + segment.durationSec * 1000,
      pausedRemainingMs: null,
      displaySec: segment.durationSec,
    },
    effects: [{ type: "announce", phase: segment.phase }],
  };
}

function tick(state: TimerState, now: number): { state: TimerState; effects: TimerEffect[] } {
  if (state.status !== "running" || state.phaseEndsAt == null) return { state, effects: [] };

  if (now < state.phaseEndsAt) {
    const segment = state.segments[state.index];
    const displaySec = Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000));
    if (!segment || displaySec === state.displaySec) return { state, effects: [] };
    return {
      state: { ...state, displaySec },
      effects: [
        {
          type: "second",
          phase: segment.phase,
          displaySec,
          durationSec: segment.durationSec,
        },
      ],
    };
  }

  let next: TimerState = { ...state };
  let crossed = 0;
  while (next.status === "running" && next.phaseEndsAt != null && now >= next.phaseEndsAt) {
    if (crossed > next.segments.length) break;
    const boundary = next.phaseEndsAt;
    const entered = enterIndex(next, next.index + 1, boundary);
    crossed += 1;
    next = entered.state;
    if (next.status === "complete") break;
  }

  const segment = next.segments[next.index];
  const phase: Phase = next.status === "complete" || !segment ? "complete" : segment.phase;
  if (next.status === "running" && segment && next.phaseEndsAt != null) {
    const startedAt = next.phaseEndsAt - segment.durationSec * 1000;
    const natural = crossed === 1 && now - startedAt < NATURAL_MS;
    if (!natural) {
      const displaySec = Math.min(
        segment.durationSec,
        Math.max(1, Math.ceil((next.phaseEndsAt - now) / 1000)),
      );
      next = { ...next, displaySec };
    }
  }

  return { state: next, effects: [{ type: "announce", phase }] };
}

export function remainingMs(state: TimerState, now: number): number {
  const segment = state.segments[state.index];
  if (!segment || segment.phase === "complete" || state.status === "complete") return 0;
  if (state.status === "idle") return segment.durationSec * 1000;
  if (state.status === "paused") return Math.max(0, state.pausedRemainingMs ?? 0);
  if (state.phaseEndsAt == null) return segment.durationSec * 1000;
  return Math.max(0, state.phaseEndsAt - now);
}

export function elapsedMs(state: TimerState, now: number): number {
  const total = totalDurationSec(state.segments) * 1000;
  if (state.status === "idle") return 0;
  if (state.status === "complete") return total;
  let done = 0;
  for (let i = 0; i < state.index; i += 1) done += state.segments[i].durationSec * 1000;
  const segment = state.segments[state.index];
  if (!segment) return Math.min(total, done);
  const into = segment.durationSec * 1000 - remainingMs(state, now);
  return Math.min(total, Math.max(0, done + into));
}

export type TimerView = {
  status: TimerStatus;
  phase: Phase;
  displaySec: number;
  progress: number;
  round: number;
  rounds: number;
  cycle: number;
  cycles: number;
  nextText: string;
  elapsedSec: number;
  totalSec: number;
  paused: boolean;
};

export function selectView(state: TimerState, now: number): TimerView {
  const segment = state.segments[state.index] ?? state.segments[0];
  const totalSec = totalDurationSec(state.segments);
  const phase: Phase =
    state.status === "complete" || !segment || segment.phase === "complete"
      ? "complete"
      : segment.phase;
  const rem = remainingMs(state, now);
  const durationMs = Math.max(1, (segment?.durationSec ?? 0) * 1000);
  const progress =
    phase === "complete" ? 1 : Math.min(1, Math.max(0, rem / durationMs));
  const upcoming = state.segments[state.index + 1];
  const nextText =
    phase === "complete"
      ? "辛苦了"
      : !upcoming || upcoming.phase === "complete"
        ? "下個階段：完成"
        : `下個階段：${PHASE_LABEL[upcoming.phase]} ${formatClock(upcoming.durationSec)}`;
  const displaySec =
    phase === "complete"
      ? totalSec
      : state.status === "idle"
        ? (segment?.durationSec ?? 0)
        : Math.max(0, Math.ceil(rem / 1000));

  return {
    status: state.status,
    phase,
    displaySec,
    progress,
    round: segment?.round || 1,
    rounds: segment?.rounds || 1,
    cycle: segment?.cycle || 1,
    cycles: segment?.cycles || 1,
    nextText,
    elapsedSec: Math.floor(elapsedMs(state, now) / 1000),
    totalSec,
    paused: state.status === "paused",
  };
}
