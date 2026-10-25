import { useEffect, useState } from "react";
import { totalDurationSec } from "../timer/plan";
import { formatClock } from "../timer/format";
import { selectView, type TimerState } from "../timer/engine";
import { PHASE_LABEL, type TimerConfig } from "../timer/types";
import { IconGear, IconPause, IconPlay, IconReset, IconSkip } from "./Icons";
import { ProgressCard } from "./ProgressCard";
import { Ring } from "./Ring";

const PHASE_INK: Record<string, string> = {
  prepare: "#1A6C70",
  work: "#0F5558",
  rest: "#8A5340",
  cycleRest: "#7A5840",
  cooldown: "#3C6E6B",
  complete: "#0F5558",
};

export function TimerScreen({
  preset,
  state,
  progressRef,
  onOpenSettings,
  onPrimary,
  onReset,
  onSkip,
}: {
  preset: TimerConfig;
  state: TimerState;
  progressRef: { current: () => number };
  onOpenSettings: () => void;
  onPrimary: () => void;
  onReset: () => void;
  onSkip: () => void;
}) {
  const view = selectView(state, Date.now());
  const [confirm, setConfirm] = useState(false);
  const [live, setLive] = useState("");
  const total = totalDurationSec(state.segments);
  const primaryLabel =
    view.status === "running" ? "暫停" : view.status === "paused" ? "繼續" : view.status === "complete" ? "再練一次" : "開始";

  useEffect(() => {
    if (view.status === "idle") setLive("準備開始");
    else if (view.paused) setLive("已暫停");
    else setLive(`${PHASE_LABEL[view.phase]}，${view.status === "complete" ? "訓練完成" : "進行中"}`);
  }, [view.phase, view.status, view.paused]);

  function requestReset() {
    if (view.status === "running" || view.status === "paused") setConfirm(true);
    else onReset();
  }

  return (
    <section className="train" data-status={view.status} data-phase={view.phase}>
      <header className="topbar">
        <div className="title-line">
          <span className="topbar-spacer" />
          <h1>{preset.name}</h1>
          <button type="button" className="gear-btn" onClick={onOpenSettings} aria-label="設定">
            <IconGear />
          </button>
        </div>
        <p data-testid="total-time">
          總時間 {formatClock(view.elapsedSec)} / {formatClock(total)}
        </p>
      </header>

      <div className="stage">
        <div className="dial">
          <Ring phase={view.phase} paused={view.paused} progressRef={progressRef}>
            <div className="phase-pill" data-testid="phase-label" style={{ color: PHASE_INK[view.phase] }}>
              {PHASE_LABEL[view.phase]}
            </div>
            <div className="clock" data-testid="timer-clock" aria-label={formatClock(view.displaySec)} key={`${view.phase}-${view.displaySec}`}>
              <ClockFace seconds={view.displaySec} />
            </div>
            <NextPhase paused={view.paused} text={view.nextText} />
          </Ring>
        </div>
      </div>

      <div className="stats">
        <ProgressCard
          label="週期"
          current={view.round}
          total={view.rounds}
          complete={view.status === "complete"}
          tone="water"
          testId="round-label"
        />
        <ProgressCard
          label="循環"
          current={view.cycle}
          total={view.cycles}
          complete={view.status === "complete"}
          tone="sand"
          testId="cycle-label"
          opening={view.status === "idle" || view.phase === "prepare"}
        />
      </div>

      <div className="controls">
        <button
          type="button"
          className="ctrl restart"
          onClick={requestReset}
          disabled={view.status === "idle"}
          aria-label="重新開始"
          data-testid="reset"
        >
          <IconReset />
        </button>
        <button
          type="button"
          className="ctrl primary"
          onClick={onPrimary}
          aria-label={primaryLabel}
          data-testid="start-pause"
        >
          {view.status === "running" ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          className="ctrl"
          onClick={onSkip}
          disabled={view.status === "idle" || view.status === "complete"}
          aria-label="跳過這個階段"
          data-testid="skip"
        >
          <IconSkip />
        </button>
      </div>

      <div className="sr-only" aria-live="polite">
        {live}
      </div>

      {confirm ? (
        <div className="backdrop" onClick={() => setConfirm(false)}>
          <div
            className="dialog glass"
            role="alertdialog"
            aria-labelledby="reset-title"
            aria-describedby="reset-copy"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reset-title">要重新開始嗎？</h2>
            <p id="reset-copy">目前的進度會清除，計時回到準備階段。</p>
            <div className="dialog-actions column">
              <button type="button" className="text-btn" onClick={() => setConfirm(false)}>
                繼續訓練
              </button>
              <button
                type="button"
                className="solid-btn"
                onClick={() => {
                  setConfirm(false);
                  onReset();
                }}
              >
                重新開始
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NextPhase({ paused, text }: { paused: boolean; text: string }) {
  const detail = text.startsWith("下個階段：") ? text.slice("下個階段：".length) : null;
  return (
    <div className="next-chip" data-testid="next-phase" aria-label={paused ? "已暫停" : text}>
      {paused || detail === null ? (
        <span>{paused ? "已暫停" : text}</span>
      ) : (
        <>
          <span className="next-marks" aria-hidden="true">
            <Triangle />
            <Triangle />
          </span>
          <span>{detail}</span>
        </>
      )}
    </div>
  );
}

function Triangle() {
  return (
    <svg viewBox="0 0 8 10" aria-hidden="true">
      <path d="M0.8 0.6 L7.2 5 L0.8 9.4 Z" fill="currentColor" />
    </svg>
  );
}

function ClockFace({ seconds }: { seconds: number }) {
  return [...formatClock(seconds)].map((char, index) =>
    char === ":" ? (
      <span className="clock-colon" aria-hidden="true" key={index}>
        <i />
        <i />
      </span>
    ) : (
      <span className="clock-digits" key={index}>
        {char}
      </span>
    ),
  );
}
