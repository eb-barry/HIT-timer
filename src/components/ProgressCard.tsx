import { BEAD_COLORS, beadPath, beadSpans, beadStates, type BeadTone } from "./beads";

export function ProgressCard({
  label,
  current,
  total,
  complete,
  tone,
  testId,
}: {
  label: string;
  current: number;
  total: number;
  complete: boolean;
  tone: BeadTone;
  testId: string;
}) {
  const colors = BEAD_COLORS[tone];
  const states = beadStates(total, current, complete);
  const spans = beadSpans(states.length);
  const shown = states.length === 0 ? 1 : Math.min(states.length, Math.max(1, Math.round(current)));

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
              <feFlood floodColor={colors.glow} floodOpacity="1" result="core" />
              <feFlood floodColor={colors.aura} floodOpacity="0.9" result="bloom" />
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
