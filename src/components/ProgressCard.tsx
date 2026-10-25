import { BEAD_COLORS, CYCLE_RIM, beadPath, beadSpans, beadStates, type BeadTone } from "./beads";

export function ProgressCard({
  label,
  current,
  total,
  complete,
  tone,
  testId,
  opening = false,
}: {
  label: string;
  current: number;
  total: number;
  complete: boolean;
  tone: BeadTone;
  testId: string;
  /** Cycle card, before the first work interval: light-green rim. */
  opening?: boolean;
}) {
  const colors = BEAD_COLORS[tone];
  const states = beadStates(total, current, complete);
  const spans = beadSpans(states.length);
  const shown = states.length === 0 ? 1 : Math.min(states.length, Math.max(1, Math.round(current)));
  const rim = tone === "sand" && opening ? CYCLE_RIM.opening : CYCLE_RIM.during;

  return (
    <article
      className={`glass stat stat-${tone}`}
      role="group"
      aria-label={`${label} ${shown}，共 ${states.length}`}
      data-current={shown}
      data-total={states.length}
      data-complete={complete ? "true" : "false"}
    >
      <p className="stat-title" data-testid={testId} aria-hidden="true">
        {states.length} 個{label}
      </p>
      <div className="bead-wrap" aria-hidden="true">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <filter id={`bead-glow-${tone}`} filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.05" result="tight" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="wide" />
              <feFlood floodColor={tone === "sand" ? rim.glow : colors.glow} floodOpacity="1" result="core" />
              <feFlood floodColor={tone === "sand" ? rim.aura : colors.aura} floodOpacity="0.9" result="bloom" />
              <feComposite in="core" in2="tight" operator="in" result="coreGlow" />
              <feComposite in="bloom" in2="wide" operator="in" result="auraGlow" />
              <feMerge>
                <feMergeNode in="auraGlow" />
                <feMergeNode in="coreGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {spans.map((span, index) => {
            const state = states[index];
            if (tone === "sand" && state === "current") {
              return (
                <g key={index} data-state={state} data-rim={opening ? "green" : "yellow"}>
                  <path
                    className="bead"
                    d={beadPath(span.start, span.end, 44, 37.6)}
                    fill={rim.fill}
                    filter={`url(#bead-glow-${tone})`}
                  />
                  <path className="bead" d={beadPath(span.start, span.end, 38.1, 31)} fill="#FFFFFF" />
                </g>
              );
            }
            return (
              <path
                key={index}
                className="bead"
                data-state={state}
                d={beadPath(span.start, span.end)}
                fill={colors[state]}
                filter={state === "current" ? `url(#bead-glow-${tone})` : undefined}
              />
            );
          })}
        </svg>
        <strong className="bead-num" aria-hidden="true">
          {shown}
        </strong>
      </div>
    </article>
  );
}
