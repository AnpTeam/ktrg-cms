/**
 * A course badge: a medal with a progress ring. The ring is grey and fills in moss green as stamps are collected (3 of 9 is a
 * third of it, from the top); when the course is done the ring is full and the medal is a vermilion disc with two ribbon tails.
 * Different from the stamp seal on purpose: a seal is one place, a medal is a whole course. Decorative: the page gives the
 * text (the course name and n / N).
 */
export function Medal({ number, done, stamped, total, className = "" }: { number: number; done: boolean; stamped: number; total: number; className?: string }) {
  const share = done ? 1 : total > 0 ? Math.min(1, stamped / total) : 0;
  return (
    <svg viewBox="0 0 120 132" aria-hidden="true" className={className}>
      {done ? (
        <g className="fill-accent">
          <path d="M40 98 L30 128 L46 120 L54 130 L62 100 Z" />
          <path d="M80 98 L90 128 L74 120 L66 130 L58 100 Z" />
        </g>
      ) : null}
      <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className="stroke-line" />
      {share > 0 ? (
        // pathLength=100 so the dash is a percentage; start at 12 o'clock.
        <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${share * 100} 100`} transform="rotate(-90 60 60)" className="stroke-moss" />
      ) : null}
      <circle cx="60" cy="60" r="44" className={done ? "fill-shu" : "fill-surface"} />
      {done ? <circle cx="60" cy="60" r="38" fill="none" strokeWidth="1.8" className="stroke-on-shu" /> : null}
      <text x="60" y="76" textAnchor="middle" fontWeight="700" fontSize="46" className={`font-serif ${done ? "fill-on-shu" : "fill-muted"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {number}
      </text>
    </svg>
  );
}
