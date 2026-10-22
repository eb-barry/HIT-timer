import type { ClipId } from "./audio/clips";
import { isClipId } from "./audio/clips";
import { sanitizeAudio, type AudioSettings } from "./audio/settings";
import { DEFAULT_PRESET, TABATA_PRESET, sanitizeConfig } from "./timer/plan";
import type { TimerConfig } from "./timer/types";

const KEY = "hiit-timer-v1";

export type Persisted = {
  version: 1;
  presets: TimerConfig[];
  activeId: string;
  audio: AudioSettings;
  mp3Clips: ClipId[];
  hintSeen: boolean;
};

export function freshState(): Persisted {
  return {
    version: 1,
    presets: [DEFAULT_PRESET, TABATA_PRESET],
    activeId: DEFAULT_PRESET.id,
    audio: sanitizeAudio(null),
    mp3Clips: [],
    hintSeen: false,
  };
}

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    return normalize(JSON.parse(raw));
  } catch {
    return freshState();
  }
}

export function savePersisted(state: Persisted) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function normalize(value: unknown): Persisted {
  const fallback = freshState();
  if (!value || typeof value !== "object") return fallback;
  const record = value as Partial<Persisted>;
  const presets = Array.isArray(record.presets)
    ? record.presets
        .filter((item): item is TimerConfig => Boolean(item) && typeof item === "object")
        .map((item, index) =>
          sanitizeConfig({
            ...DEFAULT_PRESET,
            ...item,
            id: typeof item.id === "string" && item.id ? item.id : `preset-${index}`,
          }),
        )
    : [];
  const safePresets = presets.length > 0 ? presets : fallback.presets;
  const activeId = safePresets.some((preset) => preset.id === record.activeId)
    ? (record.activeId as string)
    : safePresets[0].id;
  const mp3Clips = Array.isArray(record.mp3Clips) ? record.mp3Clips.filter(isClipId) : [];
  return {
    version: 1,
    presets: safePresets,
    activeId,
    audio: sanitizeAudio(record.audio),
    mp3Clips,
    hintSeen: record.hintSeen === true,
  };
}

export function duplicateName(name: string, presets: TimerConfig[]): string {
  const base = name.replace(/\s+\d+$/, "");
  let index = 2;
  let next = `${base} ${index}`;
  const names = new Set(presets.map((preset) => preset.name));
  while (names.has(next)) {
    index += 1;
    next = `${base} ${index}`;
  }
  return next.slice(0, 24);
}
