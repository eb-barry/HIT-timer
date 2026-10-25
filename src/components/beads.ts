/** Segmented progress beads. Angle 0 is 12 o'clock; angles increase clockwise. */

export type BeadTone = "water" | "sand";
export type BeadState = "future" | "done" | "current";

export const BEAD_COLORS: Record<BeadTone, { future: string; done: string; current: string; glow: string; aura: string }> = {
  water: { future: "#1B6E70", done: "#7EE8E2", current: "#E9FFFB", glow: "#7EFFF6", aura: "#14F0E4" },
  sand: { future: "#8A6248", done: "#E2B07C", current: "#FFFFFF", glow: "#FFE7A8", aura: "#F0C85A" },
};

/** In-progress cycle bead: white inside, a glowing rim outside. */
export const CYCLE_RIM = {
  opening: { fill: "#A9F0DC", glow: "#E9FFF8", aura: "#67E6C4" },
  during: { fill: "#F6E3A4", glow: "#FFE7A8", aura: "#F0C85A" },
};

const TAU = Math.PI * 2;
/** Ink gap at the midline of a ~132px ring is about 4px. */
const GAP = 0.08;
const CX = 50;
const CY = 50;
const OUTER = 44;
const INNER = 31;

export function beadStates(count: number, current: number, complete: boolean): BeadState[] {
  const total = normalizeCount(count);
  const at = Math.min(total, Math.max(1, Math.round(current)));
  return Array.from({ length: total }, (_, index) => {
    if (complete) return "done";
    if (index < at - 1) return "done";
    if (index === at - 1) return "current";
    return "future";
  });
}

export function beadSpans(count: number): Array<{ start: number; end: number }> {
  const total = normalizeCount(count);
  const slot = TAU / total;
  const gap = Math.min(GAP, slot * 0.28);
  const span = slot - gap;
  return Array.from({ length: total }, (_, index) => {
    const mid = index * slot;
    return { start: mid - span / 2, end: mid + span / 2 };
  });
}

export function beadPath(start: number, end: number, outer = OUTER, inner = INNER): string {
  const span = Math.max(0, end - start);
  if (span <= 0.001 || outer <= inner) return "";
  const thickness = outer - inner;
  let cr = Math.min(2.35, thickness * 0.34);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const outerInset = Math.asin(clamp01(cr / (outer - cr)));
    const innerInset = Math.asin(clamp01(cr / (inner + cr)));
    if (outerInset * 2 < span - 0.004 && innerInset * 2 < span - 0.004) break;
    cr *= 0.7;
  }
  if (cr < 0.45) return plainSector(start, end, outer, inner);
  return roundedSector(start, end, cr, outer, inner);
}

function roundedSector(start: number, end: number, cr: number, outer: number, inner: number): string {
  const outerInset = Math.asin(cr / (outer - cr));
  const innerInset = Math.asin(cr / (inner + cr));
  const outerSide = (outer - cr) * Math.cos(outerInset);
  const innerSide = (inner + cr) * Math.cos(innerInset);
  const outerStart = point(outer, start + outerInset);
  const outerEnd = point(outer, end - outerInset);
  const innerEnd = point(inner, end - innerInset);
  const innerStart = point(inner, start + innerInset);
  const capStartOuter = point(outerSide, start);
  const capStartInner = point(innerSide, start);
  const capEndOuter = point(outerSide, end);
  const capEndInner = point(innerSide, end);
  const centers = {
    outerStart: point(outer - cr, start + outerInset),
    outerEnd: point(outer - cr, end - outerInset),
    innerEnd: point(inner + cr, end - innerInset),
    innerStart: point(inner + cr, start + innerInset),
  };
  const largeOuter = end - start - outerInset * 2 > Math.PI ? 1 : 0;
  const largeInner = end - start - innerInset * 2 > Math.PI ? 1 : 0;

  return [
    `M ${fmt(capStartOuter)}`,
    arc(cr, capStartOuter, outerStart, centers.outerStart),
    `A ${trim(outer)} ${trim(outer)} 0 ${largeOuter} 1 ${fmt(outerEnd)}`,
    arc(cr, outerEnd, capEndOuter, centers.outerEnd),
    `L ${fmt(capEndInner)}`,
    arc(cr, capEndInner, innerEnd, centers.innerEnd),
    `A ${trim(inner)} ${trim(inner)} 0 ${largeInner} 0 ${fmt(innerStart)}`,
    arc(cr, innerStart, capStartInner, centers.innerStart),
    "Z",
  ].join(" ");
}

function plainSector(start: number, end: number, outer: number, inner: number): string {
  const outerStart = point(outer, start);
  const outerEnd = point(outer, end);
  const innerEnd = point(inner, end);
  const innerStart = point(inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${fmt(outerStart)} A ${trim(outer)} ${trim(outer)} 0 ${large} 1 ${fmt(outerEnd)} L ${fmt(innerEnd)} A ${trim(inner)} ${trim(inner)} 0 ${large} 0 ${fmt(innerStart)} Z`;
}

function arc(radius: number, from: [number, number], to: [number, number], center: [number, number]): string {
  const sweep = sweepFlag(center, from, to);
  return `A ${trim(radius)} ${trim(radius)} 0 0 ${sweep} ${fmt(to)}`;
}

/** SVG sweep-flag 1 is clockwise in a y-down coordinate system. */
function sweepFlag(center: [number, number], from: [number, number], to: [number, number]): 0 | 1 {
  const cross = (from[0] - center[0]) * (to[1] - center[1]) - (from[1] - center[1]) * (to[0] - center[0]);
  return cross >= 0 ? 1 : 0;
}

function point(radius: number, theta: number): [number, number] {
  return [CX + radius * Math.sin(theta), CY - radius * Math.cos(theta)];
}

function fmt(pair: [number, number]): string {
  return `${trim(pair[0])} ${trim(pair[1])}`;
}

function trim(value: number): string {
  return value.toFixed(2);
}

function clamp01(value: number): number {
  return Math.min(0.95, Math.max(0, value));
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(99, Math.max(1, Math.round(count)));
}
