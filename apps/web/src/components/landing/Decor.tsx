import type { CSSProperties } from "react";
import type { Ground } from "@/components/landing/Chapter";

// Our own line drawings behind the landing's chapters (docs/design-language.md, Motion): things a walker of Katsuragi
// Shugen meets, drawn plain and drawn once, in the chapter's own text colour at low strength (currentColor), so they follow
// light and dark mode and never fight the words. Inline SVG, no picture, no script. They are decoration: hidden from screen
// readers, never clickable, and they stand behind the words (the chapter makes a stacking context for them).
//  - SutraScroll: a Lotus Sutra scroll, for the stamp rally (the sutra was buried at the 28 mounds).
//  - KuzuVine: the kuzu vine 葛 that 葛城 is named for, growing down its chapter.
//  - StaffAndWaves: a monk's ringed staff 錫杖 over waves 青海波, for the story (the walk begins at sea).
//  - SeamFade: the soft join between two chapters whose grounds differ.
// Movement is gentle and only through transform or clip: `.decor-drift` follows the scroll scene's progress (--journey) and
// StoryMotion drifts `data-parallax` and grows `data-grow`; with reduced motion or calm they stand still, fully drawn.

const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A sutra scroll lying slightly tilted: the roller with its knobs on the left, the sheet with columns of (dashed) text. */
export function SutraScroll() {
  return (
    <div
      aria-hidden="true"
      className="decor-drift pointer-events-none absolute bottom-6 -right-20 -z-10 w-[22rem] rotate-[-7deg] opacity-[0.16] @[42rem]:right-6 @[42rem]:w-[30rem]"
      style={{ "--drift": "-26svh" } as CSSProperties}
    >
      <svg viewBox="0 0 330 200" className="h-auto w-full" {...line}>
        <rect x="18" y="52" width="34" height="96" rx="17" />
        <path d="M31 62 q-6 38 0 76 M41 60 q6 40 0 80" />
        <circle cx="35" cy="43" r="6" />
        <circle cx="35" cy="157" r="6" />
        <path d="M52 58 H298 q6 0 6 6 V136 q0 6 -6 6 H52" />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${80 + i * 25} 76 V${126 - (i % 3) * 8}`} strokeDasharray={i % 2 === 0 ? "7 6" : "5 7"} />
        ))}
        <path d="M304 100 q16 8 12 30 t-5 32" />
        <circle cx="311" cy="166" r="4" />
      </svg>
    </div>
  );
}

/** One leaf of the kuzu vine: three leaflets (the plant's mark) on a short stalk, pointing up from where it is placed. */
function KuzuLeaf({ x, y, turn }: { x: number; y: number; turn: number }) {
  const leaflet = "M0 0 C-7 -10 -6 -24 0 -32 C6 -24 7 -10 0 0Z";
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <path d={leaflet} />
      <path d="M0 -2 V-26" strokeWidth={1} />
      <path d={leaflet} transform="rotate(-52) scale(.72)" />
      <path d={leaflet} transform="rotate(52) scale(.72)" />
    </g>
  );
}

/** The kuzu vine along the right edge of a chapter. `data-grow` lets StoryMotion grow it down the chapter as it scrolls by. */
export function KuzuVine() {
  return (
    <div aria-hidden="true" data-parallax="" className="pointer-events-none absolute right-0 top-8 -z-10 h-[44rem] w-28 opacity-[0.2] @[42rem]:right-6 @[42rem]:w-32">
      <svg data-grow="" viewBox="0 0 120 600" className="h-full w-full" preserveAspectRatio="xMaxYMin meet" {...line}>
        <path d="M60 0 C55 40 30 60 38 100 S90 150 82 200 S30 260 46 300 S92 360 78 420 S30 470 50 520 S70 570 60 600" />
        <KuzuLeaf x={38} y={100} turn={-52} />
        <KuzuLeaf x={82} y={200} turn={52} />
        <KuzuLeaf x={46} y={300} turn={-52} />
        <KuzuLeaf x={78} y={420} turn={52} />
        <KuzuLeaf x={50} y={520} turn={-52} />
        <path d="M82 200 q16 -2 18 12 q-2 9 -9 6" strokeWidth={1.2} />
        <path d="M46 300 q-18 0 -20 14 q3 9 10 5" strokeWidth={1.2} />
      </svg>
    </div>
  );
}

/**
 * A ringed staff (the shakujō a mountain monk carries: a large ring on a stem, small rings hanging from it) at the left,
 * and a band of waves along the bottom that fades upward: the walk starts at the sea.
 */
export function StaffAndWaves() {
  const rings = (r: number) => `M0 ${30 - r} A${r} ${r} 0 0 1 ${r} 30 M${60 - r} 30 A${r} ${r} 0 0 1 60 ${30 - r} M${30 - r} 60 A${r} ${r} 0 0 1 ${30 + r} 60`;
  return (
    <>
      <div aria-hidden="true" className="decor-waves pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[55%] opacity-[0.12]">
        <svg className="size-full" {...line} strokeWidth={1.2}>
          <defs>
            <pattern id="seigaiha" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d={`${rings(28)} ${rings(19)} ${rings(10)}`} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#seigaiha)" stroke="none" />
        </svg>
      </div>
      <div
        aria-hidden="true"
        className="decor-drift pointer-events-none absolute -left-2 top-6 -z-10 h-[26rem] w-16 opacity-[0.14] @[42rem]:left-8"
        style={{ "--drift": "-22svh" } as CSSProperties}
      >
        <svg viewBox="0 0 80 520" className="h-full w-full" preserveAspectRatio="xMidYMin meet" {...line}>
          <circle cx="40" cy="12" r="6" />
          <circle cx="40" cy="72" r="30" />
          <circle cx="9" cy="62" r="7" />
          <circle cx="9" cy="86" r="7" />
          <circle cx="71" cy="62" r="7" />
          <circle cx="71" cy="86" r="7" />
          <path d="M40 18 V42 M32 110 H48 M40 102 V520" />
          <path d="M40 112 l6 10 l-6 10 l-6 -10 Z" />
        </svg>
      </div>
    </>
  );
}

const TOKEN: Record<Ground, string> = {
  "story-ground-paper": "var(--color-paper)",
  "story-ground-surface": "var(--color-surface)",
  "story-ground-inverse": "var(--color-night)",
};

/**
 * The soft join at the top of a chapter whose ground differs from the one above it: the chapter above is faded in over the
 * first stretch (a gradient from its colour) with two slow mist banks across it. Nothing when the grounds are the same.
 */
export function SeamFade({ from, to }: { from: Ground | null; to: Ground }) {
  if (!from || from === to) return null;
  const color = TOKEN[from];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[clamp(7rem,26vw,12rem)] overflow-hidden" style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }}>
      <span data-parallax="" className="absolute -left-10 top-0 h-16 w-3/4 rounded-full opacity-70 blur-2xl" style={{ background: color }} />
      <span data-parallax="" className="absolute -right-12 top-6 h-14 w-2/3 rounded-full opacity-60 blur-2xl" style={{ background: color }} />
    </div>
  );
}
