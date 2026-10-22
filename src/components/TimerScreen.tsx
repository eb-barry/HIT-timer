import { useEffect, useState } from "react";
import { briefSummary, totalDurationSec } from "../timer/plan";
import { formatClock } from "../timer/format";
import { selectView, type TimerState } from "../timer/engine";
import { PHASE_EN, PHASE_LABEL, type TimerConfig } from "../timer/types";
import { IconGear, IconPause, IconPlay, IconReset, IconSkip, IconSpeaker } from "./Icons";
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
  caption,
  progressRef,
  muted,
  onToggleMute,
  onOpenSettings,
  onPrimary,
  onReset,
  onSkip,
}: {
  preset: TimerConfig;
  state: TimerState;
  caption: string | null;
  progressRef: { current: () => number };
  muted: boolean;
  onToggleMute: () => void;
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
        <button type="button" className="icon-btn" onClick={onToggleMute} aria-pressed={muted} aria-label={muted ? "開啟聲音" : "靜音"}>
          <IconSpeaker muted={muted} />
        </button>
        <div className="titles">
          <h1>{preset.name}</h1>
          <p data-testid="total-time">
            總時間 {formatClock(view.elapsedSec)} / {formatClock(total)}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="週期設定">
          <IconGear />
        </button>
      </header>
      <p className="summary">{briefSummary(preset)}</p>

      <div className="stage">
        <Ring phase={view.phase} paused={view.paused} progressRef={progressRef}>
          <div className="phase-pill" data-testid="phase-label" style={{ color: PHASE_INK[view.phase] }}>
            {PHASE_LABEL[view.phase]}
            <small>{PHASE_EN[view.phase]}</small>
          </div>
          <div className="cue-slot">{caption ? <span className="cue-flash">{caption}</span> : null}</div>
          <div className="clock" data-testid="timer-clock" key={`${view.phase}-${view.displaySec}`}>
            {formatClock(view.displaySec)}
          </div>
          <div className="next-chip" data-testid="next-phase">
            {view.paused ? "已暫停" : view.nextText}
          </div>
        </Ring>
      </div>

      <div className="stats">
        <article className="glass stat">
          <span className="stat-label">
            <i className="mini-pebble pebble-water" />
            週期
          </span>
          <p data-testid="round-label">
            <strong>{view.round}</strong>
            <span>/ {view.rounds}</span>
          </p>
        </article>
        <article className="glass stat">
          <span className="stat-label">
            <i className="mini-pebble pebble-sand" />
            循環
          </span>
          <p data-testid="cycle-label">
            <strong>{view.cycle}</strong>
            <span>/ {view.cycles}</span>
          </p>
        </article>
      </div>

      <div className="controls">
        <button
          type="button"
          className="glass ctrl"
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
          className="glass ctrl"
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
