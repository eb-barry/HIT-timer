import { COUNT_VIBRATION, COUNT_WORD, phaseBeep, phaseVibration, secondCues, type BeepKind } from "../timer/cues";
import type { TimerEffect } from "../timer/engine";
import type { Phase } from "../timer/types";
import { clipById, countClip, isClipId, VOICE_CLIPS, type ClipId } from "./clips";
import type { AudioSettings } from "./settings";

const PHASE_CLIP: Record<Phase, ClipId> = {
  prepare: "prepare",
  work: "work",
  rest: "rest",
  cycleRest: "cycleRest",
  cooldown: "cooldown",
  complete: "complete",
};

type CueListener = (text: string | null) => void;

class AudioController {
  private ctx: AudioContext | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private cache = new Map<ClipId, AudioBuffer | null>();
  private generation = 0;
  private previewRun = 0;
  private cueListener: CueListener | null = null;

  setCueListener(listener: CueListener | null) {
    this.cueListener = listener;
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    window.speechSynthesis?.getVoices();
  }

  stop() {
    this.generation += 1;
    this.previewRun += 1;
    this.stopSource();
    window.speechSynthesis?.cancel();
  }

  async warmup(ids: ClipId[]): Promise<ClipId[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    try {
      this.ensure();
    } catch {
      return [];
    }
    const found: ClipId[] = [];
    await Promise.all(
      unique.map(async (id) => {
        const buffer = await this.loadClip(id);
        if (buffer) found.push(id);
      }),
    );
    return found;
  }

  async detectAll(): Promise<ClipId[]> {
    this.unlock();
    const found: ClipId[] = [];
    for (const clip of VOICE_CLIPS) {
      const buffer = await this.loadClip(clip.id, true);
      if (buffer) found.push(clip.id);
    }
    return found;
  }

  play(effects: TimerEffect[], settings: AudioSettings) {
    this.previewRun += 1;
    for (const effect of effects) {
      if (effect.type === "announce") this.announce(effect.phase, settings);
      else this.onSecond(effect, settings);
    }
  }

  async preview(settings: AudioSettings) {
    const run = ++this.previewRun;
    const sequence: { id: ClipId; beep: BeepKind }[] = [
      { id: "prepare", beep: "tick" },
      { id: "three", beep: "tick" },
      { id: "two", beep: "tick" },
      { id: "one", beep: "tick" },
      { id: "work", beep: "high" },
      { id: "rest", beep: "low" },
      { id: "complete", beep: "done" },
    ];
    for (const step of sequence) {
      if (run !== this.previewRun) return;
      this.cueListener?.(clipById(step.id).text);
      if (!settings.muted && settings.beep && settings.beepVolume > 0) {
        this.beep(step.beep, settings.beepVolume);
      }
      if (!settings.muted && settings.voice && settings.voiceVolume > 0) {
        await this.speak(step.id, settings.voiceVolume);
      } else {
        await wait(280);
      }
      await wait(180);
    }
    if (run === this.previewRun) this.cueListener?.(null);
  }

  private announce(phase: Phase, settings: AudioSettings) {
    this.cueListener?.(clipById(PHASE_CLIP[phase]).text);
    const audible = !settings.muted;
    if (audible && settings.voice && settings.voiceVolume > 0) {
      void this.speak(PHASE_CLIP[phase], settings.voiceVolume);
    } else {
      this.generation += 1;
      this.stopSource();
      window.speechSynthesis?.cancel();
    }
    if (audible && settings.beep && settings.beepVolume > 0) {
      this.beep(phaseBeep(phase), settings.beepVolume);
    }
    if (settings.vibrate) vibrate(phaseVibration(phase));
  }

  private onSecond(
    effect: Extract<TimerEffect, { type: "second" }>,
    settings: AudioSettings,
  ) {
    const cues = secondCues(effect.phase, effect.durationSec, effect.displaySec);
    for (const cue of cues) {
      if (cue.kind === "count") {
        this.cueListener?.(COUNT_WORD[cue.n]);
        if (!settings.muted && settings.voice && settings.voiceVolume > 0) {
          void this.speak(countClip(cue.n), settings.voiceVolume);
        }
        if (settings.vibrate) vibrate(COUNT_VIBRATION);
      } else if (!settings.muted && settings.beep && settings.beepVolume > 0) {
        this.beep(cue.beep, settings.beepVolume);
      }
    }
  }

  private async loadClip(id: ClipId, force = false): Promise<AudioBuffer | null> {
    if (!force && this.cache.has(id)) return this.cache.get(id) ?? null;
    try {
      const ctx = this.ensure();
      const response = await fetch(`/voices/${clipById(id).file}`, { cache: "no-cache" });
      if (!response.ok) {
        this.cache.set(id, null);
        return null;
      }
      const encoded = await response.arrayBuffer();
      const audio = await ctx.decodeAudioData(encoded.slice(0));
      this.cache.set(id, audio);
      return audio;
    } catch {
      this.cache.set(id, null);
      return null;
    }
  }

  private async speak(id: ClipId, volume: number): Promise<void> {
    const generation = ++this.generation;
    const cached = this.cache.get(id);
    if (cached) {
      await this.playBuffer(cached, volume, generation);
      return;
    }
    await this.tts(clipById(id).text, volume, generation);
  }

  private playBuffer(buffer: AudioBuffer, volume: number, generation: number): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    this.stopSource();
    window.speechSynthesis?.cancel();
    if (generation !== this.generation) return Promise.resolve();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = clampUnit(volume);
    source.connect(gain).connect(ctx.destination);
    this.voiceSource = source;
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (this.voiceSource === source) this.voiceSource = null;
        resolve();
      };
      source.onended = finish;
      source.start();
      window.setTimeout(finish, buffer.duration * 1000 + 120);
    });
  }

  private tts(text: string, volume: number, generation: number): Promise<void> {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      synth.cancel();
      window.setTimeout(() => {
        if (generation !== this.generation) {
          finish();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "zh-TW";
        utterance.rate = 1.05;
        utterance.volume = clampUnit(volume);
        const voices = synth.getVoices();
        const voice =
          voices.find((item) => item.lang.toLowerCase() === "zh-tw") ||
          voices.find((item) => item.lang.toLowerCase().startsWith("zh"));
        if (voice) utterance.voice = voice;
        utterance.onend = finish;
        utterance.onerror = finish;
        synth.speak(utterance);
        window.setTimeout(finish, 1500);
      }, 40);
    });
  }

  private beep(kind: BeepKind, volume: number) {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    const level = clampUnit(volume);
    const start = ctx.currentTime + 0.012;
    if (kind === "tick") tone(ctx, 880, start, 0.07, "sine", level * 0.42);
    if (kind === "high") {
      tone(ctx, 1040, start, 0.08, "sine", level * 0.48);
      tone(ctx, 1320, start + 0.12, 0.11, "sine", level * 0.48);
    }
    if (kind === "low") tone(ctx, 392, start, 0.18, "sine", level * 0.5);
    if (kind === "calm") tone(ctx, 523, start, 0.24, "triangle", level * 0.32);
    if (kind === "done") {
      tone(ctx, 523, start, 0.12, "sine", level * 0.4);
      tone(ctx, 659, start + 0.13, 0.12, "sine", level * 0.4);
      tone(ctx, 784, start + 0.26, 0.24, "sine", level * 0.46);
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) throw new Error("AudioContext is unavailable");
      const ctx = new Ctx();
      this.ctx = ctx;
    }
    return this.ctx;
  }

  private stopSource() {
    if (!this.voiceSource) return;
    try {
      this.voiceSource.stop();
    } catch {
      /* The source may already have ended. */
    }
    this.voiceSource = null;
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  level: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function vibrate(pattern: number[]) {
  if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export const audio = new AudioController();

export async function readListedClips(): Promise<ClipId[]> {
  try {
    const response = await fetch("/voices/index.json", { cache: "no-cache" });
    if (!response.ok) return [];
    const body = (await response.json()) as { clips?: unknown[] };
    return (body.clips ?? []).filter(isClipId);
  } catch {
    return [];
  }
}
