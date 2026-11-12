"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { setElevationCursor } from "@/lib/elevation-cursor";
import { buildProfile, gradientColor, GRADIENT_STOPS, nearestIndex, type MaybeEle } from "@/lib/elevation-profile";
import type { LatLng } from "@/lib/navigation/geometry";

const W = 300;
const H = 120;
const PAD = 4;

const legend = `linear-gradient(to right, ${GRADIENT_STOPS.map((s, i) => `${s.color} ${(i / (GRADIENT_STOPS.length - 1)) * 100}%`).join(", ")})`;

/**
 * The climb along a route, drawn from the line itself: x is real distance, the elevations are smoothed, and the line is
 * coloured by how steep each stretch is (blue downhill, green flat, red uphill). Move a mouse or a finger over it (or use
 * the arrow keys) to read the elevation, distance and slope at that point. One gradient and two paths are drawn, whatever
 * the length of the route (at most 300 points), so it stays light. The colour is never the only cue: the slope is in words.
 */
export function ElevationChart({ line, elevations, onHover }: { line: readonly LatLng[]; elevations: readonly MaybeEle[]; onHover?: (point: LatLng | null) => void }) {
  const { t, i18n } = useLingui();
  const gid = useId().replace(/:/g, "");
  const profile = useMemo(() => buildProfile(line, elevations), [line, elevations]);
  const [index, setIndex] = useState<number | null>(null);
  // Leaving the page (or the chart) takes the dot off the map.
  useEffect(() => () => setElevationCursor(null), []);
  if (!profile) return null;

  const { dist, ele, slopes, totalM, min, max, gain, loss } = profile;
  const range = Math.max(max - min, 10);
  const x = (d: number) => (totalM > 0 ? (d / totalM) * W : 0);
  const y = (e: number) => PAD + (1 - (e - min) / range) * (H - 2 * PAD);
  const top = dist.map((d, i) => `${i === 0 ? "M" : "L"}${x(d).toFixed(1)} ${y(ele[i]!).toFixed(1)}`).join(" ");
  const area = `${top} L${W} ${H - PAD} L0 ${H - PAD} Z`;
  // One colour per stretch, placed at its middle: the browser blends between them.
  const stops = slopes.map((pct, i) => ({ at: totalM > 0 ? (dist[i]! + dist[i + 1]!) / 2 / totalM : 0, color: gradientColor(pct) }));

  const nf = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const km = (m: number) => nf.format(m / 1000);
  const set = (i: number | null) => {
    setIndex(i);
    const point = i === null ? null : profile.points[i]!;
    setElevationCursor(point); // a map on the same screen shows a dot there
    onHover?.(point);
  };
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    set(nearestIndex(dist, Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * totalM));
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const cur = index ?? 0;
    const next = e.key === "ArrowRight" ? cur + step : e.key === "ArrowLeft" ? cur - step : e.key === "Home" ? 0 : e.key === "End" ? dist.length - 1 : null;
    if (e.key === "Escape") set(null);
    if (next === null) return;
    e.preventDefault();
    set(Math.min(dist.length - 1, Math.max(0, next)));
  };

  const at100 = index === null ? 0 : (x(dist[index]!) / W) * 100;
  const pct = index === null ? null : slopes[Math.min(index, slopes.length - 1)]!;
  const slopeWords = pct === null ? "" : Math.abs(pct) < 1 ? t`ほぼ平ら` : pct > 0 ? t`登り ${nf.format(Math.abs(pct))}%` : t`下り ${nf.format(Math.abs(pct))}%`;
  const here = index === null ? null : { e: Math.round(ele[index]!), k: km(dist[index]!) };
  const lowest = Math.round(min);
  const highest = Math.round(max);
  const up = Math.round(gain);
  const down = Math.round(loss);

  return (
    <figure className="flex flex-col gap-3 rounded-[1.75rem] bg-surface p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-xl font-bold">{t`標高のようす`}</span>
        <span className="flex flex-wrap gap-x-4 text-lg tabular-nums">
          <span>{t`最高 ${highest}m`}</span>
          <span>{t`最低 ${lowest}m`}</span>
          <span>{t`登り ${up}m`}</span>
          <span>{t`下り ${down}m`}</span>
        </span>
      </figcaption>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t`標高のグラフ。左右の矢印キーで、場所を動かせます。`}
        aria-valuemin={0}
        aria-valuemax={Math.round(totalM)}
        aria-valuenow={index === null ? undefined : Math.round(dist[index]!)}
        aria-valuetext={here ? t`距離 ${here.k}km、標高 ${here.e}m、${slopeWords}` : undefined}
        onPointerDown={at}
        onPointerMove={at}
        onPointerLeave={() => set(null)}
        onPointerCancel={() => set(null)}
        onKeyDown={key}
        onBlur={() => set(null)}
        style={{ touchAction: "pan-y" }}
        className="relative h-32 w-full cursor-crosshair rounded-lg outline-offset-4"
      >
        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={`g${gid}`} gradientUnits="userSpaceOnUse" x1="0" x2={W} y1="0" y2="0">
              {stops.map((s, i) => (
                <stop key={i} offset={s.at} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} className="fill-ink/10" />
          <path d={top} fill="none" stroke={`url(#g${gid})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {index !== null && here ? (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-ink/60" style={{ left: `${at100}%` }} />
            <div aria-hidden="true" className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink" style={{ left: `${at100}%`, top: `${(y(ele[index]!) / H) * 100}%` }} />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-base font-bold tabular-nums text-paper"
              style={{ left: `${Math.min(80, Math.max(20, at100))}%`, transform: "translateX(-50%)" }}
            >
              {t`${here.e}m · ${here.k}km · ${slopeWords}`}
            </div>
          </>
        ) : null}
      </div>
      <div aria-hidden="true" className="flex justify-between text-base text-muted tabular-nums">
        <span>{t`${km(0)}km`}</span>
        <span>{t`${km(totalM)}km`}</span>
      </div>
      <div aria-hidden="true" className="flex items-center gap-2 text-base text-muted">
        <span>{t`下り`}</span>
        <span className="h-2 flex-1 rounded-sm" style={{ background: legend }} />
        <span>{t`登り`}</span>
      </div>
    </figure>
  );
}
