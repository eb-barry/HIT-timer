import { describe, expect, it } from "vitest";
import { secondCues } from "./cues";
import { createIdle, reduce, selectView } from "./engine";
import { buildSegments, sanitizeConfig, DEFAULT_PRESET } from "./plan";
import type { TimerConfig } from "./types";

function plan(overrides: Partial<TimerConfig>): ReturnType<typeof buildSegments> {
  return buildSegments(sanitizeConfig({ ...DEFAULT_PRESET, id: "t", ...overrides }));
}

describe("timer engine", () => {
  it("announces each real transition, including cycle rest and cooldown", () => {
    const segments = plan({
      prepareSec: 1,
      workSec: 1,
      restSec: 10,
      rounds: 1,
      cycles: 2,
      cycleRestSec: 1,
      cooldownSec: 1,
    });
    let state = createIdle(segments);
    const spoken: string[] = [];
    const started = reduce(state, { type: "start", now: 0, segments });
    state = started.state;
    spoken.push(...started.effects.map((effect) => effect.type === "announce" ? effect.phase : ""));

    for (const at of [1000, 2000, 3000, 4000, 5000]) {
      const stepped = reduce(state, { type: "tick", now: at });
      state = stepped.state;
      for (const effect of stepped.effects) {
        if (effect.type === "announce") spoken.push(effect.phase);
        else expect(effect.type).not.toBe("second");
      }
    }

    expect(spoken).toEqual(["prepare", "work", "cycleRest", "work", "cooldown", "complete"]);
    expect(state.status).toBe("complete");
  });

  it("speaks prepare, then the last three numbers, then the work phase", () => {
    const segments = plan({
      prepareSec: 5,
      workSec: 30,
      restSec: 10,
      rounds: 1,
      cycles: 1,
      cycleRestSec: 0,
      cooldownSec: 0,
    });
    let state = reduce(createIdle(segments), { type: "start", now: 0, segments }).state;
    const heard: string[] = ["準備"];

    for (let second = 1; second <= 5; second += 1) {
      const stepped = reduce(state, { type: "tick", now: second * 1000 });
      state = stepped.state;
      for (const effect of stepped.effects) {
        if (effect.type === "announce") heard.push(effect.phase);
        if (effect.type === "second") {
          for (const cue of secondCues(effect.phase, effect.durationSec, effect.displaySec)) {
            if (cue.kind === "count") heard.push(String(cue.n));
          }
        }
      }
    }

    expect(heard).toEqual(["準備", "3", "2", "1", "work"]);
    expect(selectView(state, 5000).phase).toBe("work");
    expect(selectView(state, 5000).displaySec).toBe(30);
  });

  it("freezes on pause and does not repeat the phase name on resume", () => {
    const segments = plan({ prepareSec: 5, workSec: 10, rounds: 1, cycles: 1, restSec: 0 });
    let state = reduce(createIdle(segments), { type: "start", now: 0, segments }).state;
    state = reduce(state, { type: "tick", now: 2000 }).state;
    const paused = reduce(state, { type: "pause", now: 2000 });
    expect(paused.effects).toEqual([]);
    expect(paused.state.pausedRemainingMs).toBe(3000);

    const resumed = reduce(paused.state, { type: "resume", now: 9000 });
    expect(resumed.effects).toEqual([]);
    const later = reduce(resumed.state, { type: "tick", now: 10000 });
    expect(later.state.displaySec).toBe(2);
    expect(later.effects[0]).toMatchObject({ type: "second", displaySec: 2 });
  });

  it("skip speaks only the upcoming phase", () => {
    const segments = plan({ prepareSec: 5, workSec: 8, restSec: 4, rounds: 1, cycles: 1, cooldownSec: 3 });
    const running = reduce(createIdle(segments), { type: "start", now: 0, segments }).state;
    const skipped = reduce(running, { type: "skip", now: 1000 });
    expect(skipped.effects).toEqual([{ type: "announce", phase: "work" }]);
    expect(skipped.state.displaySec).toBe(8);
    expect(skipped.state.status).toBe("running");
  });

  it("catches up after a long gap with one announcement", () => {
    const segments = plan({ prepareSec: 5, workSec: 30, rounds: 1, cycles: 1, restSec: 0, cooldownSec: 0 });
    const running = reduce(createIdle(segments), { type: "start", now: 0, segments }).state;
    const jumped = reduce(running, { type: "tick", now: 10_000 });
    expect(jumped.effects).toEqual([{ type: "announce", phase: "work" }]);
    expect(jumped.state.displaySec).toBe(25);
    expect(selectView(jumped.state, 10_000).nextText).toBe("下個階段：完成");
  });

  it("shows the planned total while idle", () => {
    const segments = buildSegments(DEFAULT_PRESET);
    const view = selectView(createIdle(segments), 0);
    expect(view.displaySec).toBe(5);
    expect(view.phase).toBe("prepare");
    expect(view.round).toBe(1);
    expect(view.rounds).toBe(10);
    expect(view.cycle).toBe(1);
    expect(view.cycles).toBe(3);
    expect(view.totalSec).toBe(21 * 60 + 5);
    expect(view.elapsedSec).toBe(0);
    expect(view.nextText).toBe("下個階段：鍛鍊 00:30");
    expect(view.progress).toBe(1);
  });
});
