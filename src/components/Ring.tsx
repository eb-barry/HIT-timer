import { useEffect, useRef, type ReactNode } from "react";
import { publicUrl } from "../publicUrl";
import type { Phase } from "../timer/types";

const RADIUS = 39;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Outer edge of the dial track, in viewBox units. The viewBox is 90×90 centered at 50. */
const RING_OUTER_R = 45;
/** Matches `.ring-core` inset so the photo stops at the glass center. */
const CORE_INSET = 0.1335;
const BEACH_INNER_R = RING_OUTER_R - CORE_INSET * 90;
const BEACH_URL = publicUrl("beach-ring.jpg");

const RING_COLORS: Record<Phase, [string, string, string]> = {
  prepare: ["#F7FFFE", "#9AE6E1", "#14686B"],
  work: ["#F7FFFE", "#7DDED8", "#0B3E42"],
  rest: ["#FFF8F3", "#E2B79A", "#6E4E38"],
  cycleRest: ["#FBF7F1", "#E4D3C0", "#8A6248"],
  cooldown: ["#F4FFFD", "#D5E7E4", "#3E6F6C"],
  complete: ["#F7FFFE", "#B7E4DF", "#1E6A6C"],
};

export function Ring({
  phase,
  paused,
  progressRef,
  children,
}: {
  phase: Phase;
  paused: boolean;
  progressRef: { current: () => number };
  children: ReactNode;
}) {
  const progress = useRef<SVGCircleElement>(null);
  const sheen = useRef<SVGCircleElement>(null);
  const beachCover = useRef<SVGCircleElement>(null);
  const [highlight, mid, shadow] = RING_COLORS[phase];

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const ratio = Math.min(1, Math.max(0, progressRef.current()));
      const offset = String(CIRCUMFERENCE * (1 - ratio));
      if (progress.current) progress.current.style.strokeDashoffset = offset;
      if (sheen.current) sheen.current.style.strokeDashoffset = offset;
      // Same dash as the colored arc, so the photo is hidden there and shows in the grey gap.
      if (beachCover.current) beachCover.current.style.strokeDashoffset = offset;
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [progressRef]);

  return (
    <div className={paused ? "ring is-paused" : "ring"} data-phase={phase}>
      <svg className="ring-svg" viewBox="5 5 90 90" aria-hidden="true">
        <defs>
          <linearGradient id="tube" x1="18%" y1="8%" x2="82%" y2="92%">
            <stop offset="0%" stopColor={highlight} />
            <stop offset="38%" stopColor={mid} />
            <stop offset="100%" stopColor={shadow} />
          </linearGradient>
          <filter id="tubeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.4" stdDeviation="1.15" floodColor={mid} floodOpacity="0.7" />
          </filter>
        </defs>
        <circle className="ring-track" cx="50" cy="50" r={RADIUS} />
        <circle className="ring-groove" cx="50" cy="50" r={RADIUS} />
        {phase === "work" && (
          <>
            <mask id="beach-gap" maskUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r={RING_OUTER_R} fill="white" />
              <circle cx="50" cy="50" r={BEACH_INNER_R} fill="black" />
              <circle
                ref={beachCover}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="black"
                strokeWidth="16"
                strokeDasharray={CIRCUMFERENCE}
              />
            </mask>
            <g mask="url(#beach-gap)">
              <image
                href={BEACH_URL}
                x="5"
                y="5"
                width="90"
                height="90"
                transform="rotate(90 50 50)"
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
          </>
        )}
        <circle
          ref={progress}
          className="ring-progress"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          filter="url(#tubeGlow)"
        />
        <circle
          ref={sheen}
          className="ring-sheen"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
        />
      </svg>
      <div className="ring-core">{children}</div>
    </div>
  );
}
