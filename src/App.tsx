import { useEffect, useMemo, useRef, useState } from "react";
import { audio, readListedClips } from "./audio/controller";
import type { ClipId } from "./audio/clips";
import type { AudioSettings } from "./audio/settings";
import { SettingsScreen } from "./components/SettingsScreen";
import { TimerScreen } from "./components/TimerScreen";
import { useTimer } from "./hooks/useTimer";
import { duplicateName, loadPersisted, savePersisted, type Persisted } from "./storage";
import { selectView } from "./timer/engine";
import { formatClock } from "./timer/format";
import { buildSegments, sanitizeConfig } from "./timer/plan";
import { PHASE_LABEL, type TimerConfig } from "./timer/types";

export function App() {
  const [data, setData] = useState<Persisted>(() => {
    const loaded = loadPersisted();
    if (!loaded.audio.muted) return loaded;
    return { ...loaded, audio: { ...loaded.audio, muted: false } };
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const active = data.presets.find((preset) => preset.id === data.activeId) ?? data.presets[0];
  const segments = useMemo(() => buildSegments(active), [active]);
  const timer = useTimer(segments, data.audio, active.name);
  const shownPresetRef = useRef(active);
  if (timer.state.status !== "running" && timer.state.status !== "paused") {
    shownPresetRef.current = active;
  }
  const shownPreset = shownPresetRef.current;
  const running = timer.state.status === "running" || timer.state.status === "paused";
  const view = selectView(timer.state, Date.now());
  const statusNote =
    view.status === "running" || view.status === "paused"
      ? `${view.paused ? "已暫停" : PHASE_LABEL[view.phase]} ${formatClock(view.displaySec)}`
      : null;

  useEffect(() => {
    savePersisted(data);
  }, [data]);

  useEffect(() => {
    const blockCallout = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea")) return;
      event.preventDefault();
    };
    document.addEventListener("contextmenu", blockCallout);
    document.addEventListener("selectstart", blockCallout);
    return () => {
      document.removeEventListener("contextmenu", blockCallout);
      document.removeEventListener("selectstart", blockCallout);
    };
  }, []);

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const listed = await readListedClips();
      const ids = [...new Set([...data.mp3Clips, ...listed])];
      if (ids.length === 0 || cancelled) return;
      const found = await audio.warmup(ids);
      if (cancelled) return;
      setData((current) =>
        sameIds(current.mp3Clips, found) ? current : { ...current, mp3Clips: found },
      );
    })();
    return () => {
      cancelled = true;
    };
    // Warm up once from the clips saved on this device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timerId = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timerId);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, button, a, [role='switch']")) return;
      event.preventDefault();
      startOrToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function patchAudio(patch: Partial<AudioSettings>) {
    setData((current) => ({ ...current, audio: { ...current.audio, ...patch } }));
  }

  function savePreset(next: TimerConfig) {
    const clean = sanitizeConfig(next);
    setData((current) => ({
      ...current,
      presets: current.presets.map((preset) => (preset.id === clean.id ? clean : preset)),
    }));
  }

  function selectPreset(id: string) {
    setData((current) => ({ ...current, activeId: id }));
  }

  function addPreset() {
    setData((current) => {
      const source = current.presets.find((preset) => preset.id === current.activeId) ?? current.presets[0];
      const copy = sanitizeConfig({
        ...source,
        id: crypto.randomUUID(),
        name: duplicateName(source.name, current.presets),
      });
      return { ...current, presets: [...current.presets, copy], activeId: copy.id };
    });
  }

  function deletePreset(id: string) {
    setData((current) => {
      if (current.presets.length <= 1) return current;
      const presets = current.presets.filter((preset) => preset.id !== id);
      return {
        ...current,
        presets,
        activeId: current.activeId === id ? presets[0].id : current.activeId,
      };
    });
  }

  function startOrToggle() {
    const previous = timer.primary();
    if ((previous === "idle" || previous === "complete") && !data.hintSeen) {
      setToast("每個階段開始會出聲，最後三秒會倒數。若聽不到，請提高手機音量。");
      setData((current) => ({ ...current, hintSeen: true }));
    }
  }

  return (
    <div className="app">
      <div className="screen" hidden={settingsOpen}>
        <TimerScreen
          preset={shownPreset}
          state={timer.state}
          progressRef={timer.progressRef}
          onOpenSettings={() => setSettingsOpen(true)}
          onPrimary={startOrToggle}
          onReset={timer.reset}
          onSkip={timer.skip}
        />
      </div>
      <div className="screen" hidden={!settingsOpen}>
        <SettingsScreen
          preset={active}
          presets={data.presets}
          onSave={savePreset}
          onSelect={selectPreset}
          onAdd={addPreset}
          onDelete={deletePreset}
          onBack={() => setSettingsOpen(false)}
          statusNote={statusNote}
          audio={data.audio}
          onAudio={patchAudio}
          mp3Clips={data.mp3Clips}
          onMp3={(ids: ClipId[]) => setData((current) => ({ ...current, mp3Clips: ids }))}
          running={running}
        />
      </div>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function sameIds(left: ClipId[], right: ClipId[]) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
