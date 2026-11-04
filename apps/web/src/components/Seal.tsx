import { tilt, type StampState } from "./StampFace";

/**
 * A hand-drawn style hanko for one stamp slot. Four motifs (peaks under a sun, waves, a rising sun, cedars) repeat by number
 * so a row of seals does not look copied. The face is a double ring with a notched band, the motif in the middle and the
 * number on a small plate at the bottom, like a temple's own seal. The state is still the shape, never the colour alone:
 *  stamped: a filled vermilion seal, everything cut out in white, pressed (a wobbly edge) in the big grid
 *  next:    a thick ring in the readable red, the motif and number in the same red
 *  empty:   a dashed outline with a faint motif and number
 * Decorative: the grid gives screen readers the text.
 */
const MOTIFS = [
  // 山並み: two layers of peaks, a sun behind, snow lines
  <g key="peaks" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="64" cy="27" r="5" strokeWidth="2.5" />
    <path d="M24 58 L40 32 L49 46 L58 38 L76 58 Z" strokeWidth="3" />
    <path d="M34 42 l6 4 l6 -4 M54 44 l4 3 l4 -3" strokeWidth="2" />
    <path d="M30 58 H70" strokeWidth="2.5" />
  </g>,
  // 青海波: three overlapping scallops, each ringed three times
  <g key="waves" strokeLinecap="round" strokeWidth="2.4" transform="translate(0 -9) rotate(0)">
    {[32, 50, 68].map((x) => (
      <g key={x}>
        <path d={`M${x - 12} 58 a12 12 0 0 1 24 0`} />
        <path d={`M${x - 8} 58 a8 8 0 0 1 16 0`} />
        <path d={`M${x - 4} 58 a4 4 0 0 1 8 0`} />
      </g>
    ))}
    <path d="M20 58 H80" />
  </g>,
  // 日の出: a sun with eight rays over two hills and the horizon
  <g key="sun" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8">
    <path d="M38 48 a12 12 0 0 1 24 0" />
    <path d="M50 24 v5 M33 31 l4 4 M67 31 l-4 4 M26 44 h5 M69 44 h5" />
    <path d="M22 58 Q36 50 50 58 Q64 50 78 58" />
    <path d="M26 58 H74" />
  </g>,
  // 杉: three cedars of different height on the ground
  <g key="cedars" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6">
    <path d="M50 24 L40 42 H46 L37 56 H63 L54 42 H60 Z" />
    <path d="M26 56 L32 40 L38 56" />
    <path d="M62 56 L68 40 L74 56" />
    <path d="M20 58 H80" />
  </g>,
];

export function Seal({ state, number, rough = false, className = "" }: { state: StampState; number: number; rough?: boolean; className?: string }) {
  const motif = MOTIFS[(number - 1) % MOTIFS.length];
  const stamped = state === "stamped";
  const line = stamped ? "stroke-on-shu" : state === "next" ? "stroke-accent" : "stroke-muted";
  const dim = state === "empty" ? "opacity-50" : "";
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={stamped ? { transform: `rotate(${tilt(number)}deg)`, ...(rough ? { filter: `url(#stamp-ink-${(number % 3) + 1})` } : null) } : undefined}
    >
      {stamped ? (
        <circle cx="50" cy="50" r="48" className="fill-shu" />
      ) : state === "next" ? (
        <circle cx="50" cy="50" r="46" strokeWidth="5" className="fill-surface stroke-accent" />
      ) : (
        <circle cx="50" cy="50" r="46" fill="none" strokeWidth="2.5" strokeDasharray="5 5" className="stroke-line" />
      )}
      {/* Inner ring, and the notched band between it and the edge (a ring of short dashes). */}
      <g fill="none" className={`${line} ${dim}`}>
        <circle cx="50" cy="50" r={stamped ? 43 : 40} strokeWidth="1.6" />
        <circle cx="50" cy="50" r={stamped ? 39.5 : 36.5} strokeWidth="2.6" strokeDasharray="1.6 3.1" />
        {motif}
      </g>
      {/* The number on its own plate: white with the seal's red when pressed, so it reads at any size. */}
      <rect x="33" y="66" width="34" height="19" rx="9.5" className={stamped ? "fill-on-shu" : "fill-paper stroke-muted"} strokeWidth={stamped ? 0 : 1.5} opacity={state === "empty" ? 0.7 : 1} />
      <text x="50" y="80.5" textAnchor="middle" fontWeight="700" fontSize="15" className={`font-serif ${stamped ? "fill-shu" : state === "next" ? "fill-accent" : "fill-muted"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {number}
      </text>
    </svg>
  );
}
