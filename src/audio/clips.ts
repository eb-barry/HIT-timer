export const VOICE_CLIPS = [
  { id: "prepare", text: "準備", file: "prepare.mp3" },
  { id: "work", text: "鍛鍊", file: "work.mp3" },
  { id: "rest", text: "休息", file: "rest.mp3" },
  { id: "cycleRest", text: "循環休息", file: "cycle-rest.mp3" },
  { id: "cooldown", text: "冷卻", file: "cooldown.mp3" },
  { id: "complete", text: "完成", file: "complete.mp3" },
  { id: "three", text: "三", file: "three.mp3" },
  { id: "two", text: "二", file: "two.mp3" },
  { id: "one", text: "一", file: "one.mp3" },
] as const;

export type ClipId = (typeof VOICE_CLIPS)[number]["id"];

const CLIP_BY_ID = Object.fromEntries(VOICE_CLIPS.map((clip) => [clip.id, clip])) as Record<
  ClipId,
  (typeof VOICE_CLIPS)[number]
>;

export function clipById(id: ClipId): (typeof VOICE_CLIPS)[number] {
  return CLIP_BY_ID[id];
}

export function isClipId(value: unknown): value is ClipId {
  return typeof value === "string" && value in CLIP_BY_ID;
}

export function countClip(n: 1 | 2 | 3): ClipId {
  if (n === 1) return "one";
  if (n === 2) return "two";
  return "three";
}
