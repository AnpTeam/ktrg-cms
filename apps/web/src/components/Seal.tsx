import { tilt, type StampState } from "./StampFace";

/**
 * A hand-drawn style hanko for one stamp slot. Three motifs (a ridge line, waves, a rising sun) repeat by number so a row of
 * seals does not look copied. The state is still the shape, never the colour alone:
 *  stamped: a filled vermilion seal with an inner ring, the motif and the number cut out in white, pressed (a wobbly edge)
 *  next:    a thick ring in the readable red with the motif and number in the same red
 *  empty:   a dashed outline with a faint motif and number
 * Decorative: the grid gives screen readers the text.
 */
const MOTIFS = [
  // 山並み: three peaks
  <path key="ridge" d="M22 56 L38 34 L47 46 L58 28 L78 56" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />,
  // 波: two rows of arcs (青海波)
  <g key="waves" fill="none" strokeWidth="3.5" strokeLinecap="round">
    <path d="M24 46 q6-10 12 0 q6-10 12 0 q6-10 12 0 q6-10 12 0" />
    <path d="M30 57 q6-10 12 0 q6-10 12 0 q6-10 12 0" />
  </g>,
  // 日の出: a half sun over the horizon
  <g key="sun" fill="none" strokeWidth="4" strokeLinecap="round">
    <path d="M32 56 a18 18 0 0 1 36 0" />
    <path d="M22 56 H78" />
    <path d="M50 24 v6 M30 32 l4 4 M70 32 l-4 4" />
  </g>,
];

export function Seal({ state, number, rough = false, className = "" }: { state: StampState; number: number; rough?: boolean; className?: string }) {
  const motif = MOTIFS[(number - 1) % MOTIFS.length];
  const stamped = state === "stamped";
  const ink = stamped ? "stroke-on-shu fill-on-shu" : state === "next" ? "stroke-accent fill-accent" : "stroke-muted fill-muted";
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={stamped ? { transform: `rotate(${tilt(number)}deg)`, ...(rough ? { filter: `url(#stamp-ink-${(number % 3) + 1})` } : null) } : undefined}
    >
      {stamped ? (
        <>
          <circle cx="50" cy="50" r="48" className="fill-shu" />
          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="1.8" className="stroke-on-shu" />
        </>
      ) : state === "next" ? (
        <circle cx="50" cy="50" r="46" strokeWidth="6" className="fill-surface stroke-accent" />
      ) : (
        <circle cx="50" cy="50" r="46" fill="none" strokeWidth="2.5" strokeDasharray="5 5" className="stroke-line" />
      )}
      <g className={`${ink} ${state === "empty" ? "opacity-50" : ""}`} fill="none">
        {motif}
      </g>
      <text x="50" y="82" textAnchor="middle" fontWeight="700" fontSize="24" className={`${ink} font-serif`} stroke="none" style={{ fontVariantNumeric: "tabular-nums" }}>
        {number}
      </text>
    </svg>
  );
}
