import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { audio, readListedClips } from "./audio/controller";
import type { ClipId } from "./audio/clips";
import type { AudioSettings } from "./audio/settings";
import { IconMore, IconRounds, IconTimer } from "./components/Icons";
import { MoreScreen } from "./components/MoreScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { TimerScreen } from "./components/TimerScreen";
import { useTimer } from "./hooks/useTimer";
import { duplicateName, loadPersisted, savePersisted, type Persisted } from "./storage";
import { buildSegments, sanitizeConfig } from "./timer/plan";
import type { TimerConfig } from "./timer/types";

type Tab = "train" | "settings" | "more";

export function App() {
  const [data, setData] = useState<Persisted>(() => loadPersisted());
  const [tab, setTab] = useState<Tab>("train");
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

  useEffect(() => {
    savePersisted(data);
  }, [data]);

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
      <div className="screen" hidden={tab !== "train"}>
        <TimerScreen
          preset={shownPreset}
          state={timer.state}
          caption={timer.caption}
          progressRef={timer.progressRef}
          muted={data.audio.muted}
          onToggleMute={() => patchAudio({ muted: !data.audio.muted })}
          onOpenSettings={() => setTab("settings")}
          onPrimary={startOrToggle}
          onReset={timer.reset}
          onSkip={timer.skip}
        />
      </div>
      <div className="screen" hidden={tab !== "settings"}>
        <SettingsScreen
          preset={active}
          presets={data.presets}
          onSave={savePreset}
          onSelect={selectPreset}
          onAdd={addPreset}
          onDelete={deletePreset}
        />
      </div>
      <div className="screen" hidden={tab !== "more"}>
        <MoreScreen
          settings={data.audio}
          mp3Clips={data.mp3Clips}
          running={running}
          onChange={patchAudio}
          onMp3={(ids: ClipId[]) => setData((current) => ({ ...current, mp3Clips: ids }))}
        />
      </div>

      <nav className="tabbar" aria-label="主要">
        <TabButton id="train" label="間歇訓練" current={tab} onSelect={setTab} running={timer.state.status === "running"}>
          <IconTimer />
        </TabButton>
        <TabButton id="settings" label="週期設定" current={tab} onSelect={setTab}>
          <IconRounds />
        </TabButton>
        <TabButton id="more" label="更多" current={tab} onSelect={setTab}>
          <IconMore />
        </TabButton>
      </nav>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  id,
  label,
  current,
  onSelect,
  running,
  children,
}: {
  id: Tab;
  label: string;
  current: Tab;
  onSelect: (tab: Tab) => void;
  running?: boolean;
  children: ReactNode;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      className={selected ? "tab is-on" : "tab"}
      aria-current={selected ? "page" : undefined}
      data-testid={`tab-${id}`}
      onClick={() => onSelect(id)}
    >
      <span className="tab-icon">
        {children}
        {running ? <i className="live-dot" /> : null}
      </span>
      {label}
    </button>
  );
}

function sameIds(left: ClipId[], right: ClipId[]) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
