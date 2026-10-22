import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "../audio/controller";
import type { AudioSettings } from "../audio/settings";
import { PHASE_LABEL } from "../timer/types";
import { formatClock } from "../timer/format";
import {
  createIdle,
  reduce,
  remainingMs,
  selectView,
  type TimerState,
} from "../timer/engine";
import type { Segment } from "../timer/types";

export function useTimer(segments: Segment[], settings: AudioSettings, presetName: string) {
  const [state, setState] = useState<TimerState>(() => createIdle(segments));
  const [caption, setCaption] = useState<string | null>(null);
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const segmentsRef = useRef(segments);
  const nameRef = useRef(presetName);
  const progressRef = useRef<() => number>(() => 1);

  settingsRef.current = settings;
  segmentsRef.current = segments;
  nameRef.current = presetName;
  stateRef.current = state;
  progressRef.current = () => {
    const current = stateRef.current;
    const segment = current.segments[current.index];
    if (!segment || segment.durationSec <= 0 || current.status === "complete") return 1;
    return remainingMs(current, Date.now()) / (segment.durationSec * 1000);
  };

  const signature = segments
    .map((segment) => `${segment.phase}:${segment.durationSec}:${segment.round}:${segment.cycle}`)
    .join("|");
  const signatureRef = useRef(signature);
  if (signatureRef.current !== signature) {
    const abandon = state.status !== "idle";
    signatureRef.current = signature;
    const next = createIdle(segments);
    stateRef.current = next;
    if (abandon) audio.stop();
    setState(next);
  }

  useEffect(() => {
    let timer = 0;
    audio.setCueListener((text) => {
      setCaption(text);
      window.clearTimeout(timer);
      if (text) timer = window.setTimeout(() => setCaption((current) => (current === text ? null : current)), 900);
    });
    return () => {
      window.clearTimeout(timer);
      audio.setCueListener(null);
    };
  }, []);

  const apply = useCallback((action: Parameters<typeof reduce>[1]) => {
    const result = reduce(stateRef.current, action);
    stateRef.current = result.state;
    setState(result.state);
    if (action.type === "pause" || action.type === "reset") audio.stop();
    if (result.effects.length) audio.play(result.effects, settingsRef.current);
  }, []);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      if (stateRef.current.status === "running") {
        const result = reduce(stateRef.current, { type: "tick", now: Date.now() });
        if (result.state !== stateRef.current) {
          stateRef.current = result.state;
          setState(result.state);
        }
        if (result.effects.length) audio.play(result.effects, settingsRef.current);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onVisible = () => {
      if (document.visibilityState !== "visible" || stateRef.current.status !== "running") return;
      const result = reduce(stateRef.current, { type: "tick", now: Date.now() });
      if (result.state !== stateRef.current) {
        stateRef.current = result.state;
        setState(result.state);
      }
      if (result.effects.length) audio.play(result.effects, settingsRef.current);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const view = selectView(state, Date.now());
    if (state.status === "idle") document.title = "高強度間歇訓練";
    else document.title = `${formatClock(view.displaySec)} ${PHASE_LABEL[view.phase]}`;

    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: PHASE_LABEL[view.phase],
      artist: `第 ${view.cycle} 循環 · 週期 ${view.round} / ${view.rounds}`,
      album: nameRef.current,
    });
    navigator.mediaSession.playbackState = state.status === "running" ? "playing" : "paused";
  }, [state]);

  useEffect(() => {
    const media = navigator.mediaSession;
    if (!media) return;
    const primary = () => {
      audio.unlock();
      const status = stateRef.current.status;
      const now = Date.now();
      if (status === "running") apply({ type: "pause", now });
      else if (status === "paused") apply({ type: "resume", now });
    };
    try {
      media.setActionHandler("play", primary);
      media.setActionHandler("pause", primary);
      media.setActionHandler("nexttrack", () => {
        audio.unlock();
        apply({ type: "skip", now: Date.now() });
      });
    } catch {
      /* Some browsers reject handlers they do not support. */
    }
    return () => {
      try {
        media.setActionHandler("play", null);
        media.setActionHandler("pause", null);
        media.setActionHandler("nexttrack", null);
      } catch {
        /* Ignore cleanup failures. */
      }
    };
  }, [apply]);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const want = settings.wakeLock && state.status === "running";

    const acquire = async () => {
      if (!want || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) await lock.release();
      } catch {
        lock = null;
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [settings.wakeLock, state.status]);

  const primary = useCallback(() => {
    audio.unlock();
    const status = stateRef.current.status;
    const now = Date.now();
    if (status === "running") apply({ type: "pause", now });
    else if (status === "paused") apply({ type: "resume", now });
    else apply({ type: "start", now, segments: segmentsRef.current });
    return status;
  }, [apply]);

  const reset = useCallback(() => {
    apply({ type: "reset", segments: segmentsRef.current });
  }, [apply]);

  const skip = useCallback(() => {
    audio.unlock();
    apply({ type: "skip", now: Date.now() });
  }, [apply]);

  return { state, caption, progressRef, primary, reset, skip };
}
