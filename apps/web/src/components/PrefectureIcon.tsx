import { useId } from "react";
import type { Prefecture } from "@/lib/content";

/**
 * Small pictures for the prefecture filter and the headings of the route list (name always beside them):
 *  all        a trail between two points (our own line drawing)
 *  osaka, nara, wakayama   the prefecture's own emblem (都道府県章), in its official colours, on a white round
 *             badge so it reads on both the light and the dark page.
 * The emblems are the vector drawings from Wikimedia Commons (Emblem_of_Osaka_Prefecture.svg,
 * Emblem_of_Nara_Prefecture.svg, Emblem_of_Wakayama_Prefecture.svg), which Commons marks as public domain for
 * lacking original authorship. They are official insignia, whose use is restricted independently of copyright, so
 * they only identify the prefecture here; see the licenses page.
 */
export function PrefectureIcon({ value, size = 24 }: { value: Prefecture | "all"; size?: number }) {
  if (value === "all") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M5 18c5 0 4-5 8-5s3-6 6-7" />
        <circle cx="5" cy="18" r="1.6" />
        <circle cx="19" cy="6" r="1.6" />
      </svg>
    );
  }

  const badge = size + 8;
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-full bg-white"
      style={{ width: badge, height: badge }}
    >
      {value === "osaka" ? <OsakaEmblem size={size} /> : value === "nara" ? <NaraEmblem size={size} /> : <WakayamaEmblem size={size} />}
    </span>
  );
}

// Osaka: blue rings and petals. (The Commons drawing reuses its parts with <use>; the ids are made unique per
// picture so two on one page do not clash.)
function OsakaEmblem({ size }: { size: number }) {
  const id = useId();
  const [a, b, c] = [`${id}a`, `${id}b`, `${id}c`];
  return (
    <svg viewBox="-9 -6.5 18 13" width={size} height={Math.round((size * 13) / 18)}>
      <g id={b}>
        <circle id={a} cx="6" r="2" stroke="#33419a" strokeWidth="2" fill="none" />
        <use href={`#${a}`} transform="rotate(120 2 0)" />
      </g>
      <use href={`#${b}`} transform="rotate(180)" />
      <path id={c} d="M6 0a1 1 0 0 0 0 1.7320508075688773h-3A1 1 0 0 0 3 0z" fill="#33419a" transform="rotate(60 3 0)" />
      <use href={`#${c}`} transform="rotate(120 2 0)" />
      <use href={`#${c}`} transform="scale(-1 1)" />
    </svg>
  );
}

// Nara: dark red, drawn with two arcs and a bar.
function NaraEmblem({ size }: { size: number }) {
  const id = useId();
  const [round, halves] = [`${id}r`, `${id}h`];
  return (
    <svg viewBox="0 0 550 550" width={size} height={size}>
      <defs>
        <clipPath id={round}>
          <circle cx="250" cy="275" r="220" />
        </clipPath>
        <clipPath id={halves}>
          <rect x="0" y="0" width="500" height="270" />
          <rect x="0" y="280" width="500" height="270" />
        </clipPath>
      </defs>
      <g stroke="#571e21">
        <g clipPath={`url(#${round})`}>
          <g clipPath={`url(#${halves})`}>
            <circle cx="110" cy="275" r="220" fill="none" strokeWidth="288" />
          </g>
        </g>
        <line x1="110" y1="275" x2="530" y2="275" strokeWidth="80" />
      </g>
    </svg>
  );
}

// Wakayama: black, a ring open at the bottom with a stroke inside.
function WakayamaEmblem({ size }: { size: number }) {
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size}>
      <path
        fill="#000"
        d="M-19.364917 5A20 20 0 1 1 19.364917 5L0 20-8.909944 13.098387 8 0A8 8 0 0 0-8 0L-0.672511 5.675848-9.582456 12.577462z"
      />
    </svg>
  );
}
