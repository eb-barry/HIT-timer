export type AudioSettings = {
  voice: boolean;
  beep: boolean;
  voiceVolume: number;
  beepVolume: number;
  vibrate: boolean;
  wakeLock: boolean;
  muted: boolean;
};

export const defaultAudio: AudioSettings = {
  voice: true,
  beep: true,
  voiceVolume: 1,
  beepVolume: 0.75,
  vibrate: true,
  wakeLock: true,
  muted: false,
};

export function sanitizeAudio(input: Partial<AudioSettings> | null | undefined): AudioSettings {
  const source = input ?? {};
  const volume = (value: unknown, fallback: number) => {
    const number = typeof value === "number" ? value : fallback;
    if (!Number.isFinite(number)) return fallback;
    return Math.min(1, Math.max(0, number));
  };
  return {
    voice: typeof source.voice === "boolean" ? source.voice : defaultAudio.voice,
    beep: typeof source.beep === "boolean" ? source.beep : defaultAudio.beep,
    voiceVolume: volume(source.voiceVolume, defaultAudio.voiceVolume),
    beepVolume: volume(source.beepVolume, defaultAudio.beepVolume),
    vibrate: typeof source.vibrate === "boolean" ? source.vibrate : defaultAudio.vibrate,
    wakeLock: typeof source.wakeLock === "boolean" ? source.wakeLock : defaultAudio.wakeLock,
    muted: typeof source.muted === "boolean" ? source.muted : defaultAudio.muted,
  };
}
