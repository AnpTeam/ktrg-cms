import type { ReactNode } from "react";
import { areaGeometry, barPercent, sharePercent } from "@/lib/admin/visits";

// The charts of the visits screen, drawn as plain SVG and HTML (no script, no library): a daily area chart, a stacked share bar
// with its legend, and ranked rows. Colours are the site's tokens. Server-rendered; nothing here reads or stores anything.

/** The categorical colours of a share bar, in order; the last is for "the rest". */
const SLICE = ["bg-brand", "bg-ruri", "bg-moss", "bg-goal", "bg-accent"] as const;

const short = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** Views per day as an area under a line, with a scale on the left and the first, middle and last dates below. */
export function DailyChart({ days, label }: { days: { day: string; views: number }[]; label: string }) {
  const W = 800;
  const H = 220;
  const g = areaGeometry(days.map((d) => d.views), W, H);
  const mid = days[Math.floor((days.length - 1) / 2)];
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div aria-hidden="true" className="flex h-[220px] flex-col justify-between text-right text-base tabular-nums text-muted">
          {ticks.map((t) => (
            <span key={t} className="-my-2.5 leading-5">
              {Math.round(g.max * t).toLocaleString()}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[220px] w-full overflow-visible text-brand">
            <defs>
              <linearGradient id="visits-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.38" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line key={t} x1="0" x2={W} y1={H - t * H} y2={H - t * H} stroke="var(--color-line)" strokeOpacity={t === 0 ? 0.9 : 0.35} strokeWidth="1" strokeDasharray={t === 0 ? undefined : "4 6"} vectorEffect="non-scaling-stroke" />
            ))}
            {g.area ? <path d={g.area} fill="url(#visits-fill)" /> : null}
            {g.line ? <path d={g.line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
        </div>
      </div>
      <div aria-hidden="true" className="ml-[3.25rem] flex justify-between text-base tabular-nums text-muted">
        <span>{days[0] ? short(days[0].day) : ""}</span>
        <span>{mid && days.length > 4 ? short(mid.day) : ""}</span>
        <span>{days.length > 1 ? short(days[days.length - 1]!.day) : ""}</span>
      </div>
    </figure>
  );
}

/** One bar split into the biggest few and "the rest", with a legend that says each one's views and share. */
export function ShareBar({ rows, total, restLabel, unit }: { rows: { key: string; label: string; views: number }[]; total: number; restLabel: string; unit: (n: number) => string }) {
  const top = rows.slice(0, SLICE.length);
  const rest = total - top.reduce((n, r) => n + r.views, 0);
  const parts = [...top.map((r, i) => ({ ...r, color: SLICE[i]! })), ...(rest > 0 ? [{ key: "rest", label: restLabel, views: rest, color: "bg-line" }] : [])];
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden="true" className="flex h-4 w-full overflow-hidden rounded-full bg-paper">
        {parts.map((p) => (
          <span key={p.key} className={`${p.color} h-full`} style={{ width: `${(p.views / Math.max(1, total)) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-3 text-lg">
            <span aria-hidden="true" className={`${p.color} size-3.5 shrink-0 rounded-full`} />
            <span className="min-w-0 flex-1 break-words">{p.label}</span>
            <span className="tabular-nums text-muted">{sharePercent(p.views, total)}%</span>
            <span className="w-20 text-right font-bold tabular-nums">{unit(p.views)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked rows with a rank, the share, the count and a slim bar; the first `show` are open, the rest fold away. */
export function RankedRows({ rows, total, unit, more, show = 8 }: { rows: { key: string; label: string; views: number }[]; total: number; unit: (n: number) => string; more: string; show?: number }) {
  const max = Math.max(0, ...rows.map((r) => r.views));
  const row = (r: { key: string; label: string; views: number }, i: number) => (
    <li key={r.key} className="flex flex-col gap-1">
      <div className="flex items-baseline gap-3 text-lg">
        <span aria-hidden="true" className="w-6 shrink-0 text-right text-base tabular-nums text-muted">
          {i + 1}
        </span>
        <span className="min-w-0 flex-1 break-all">{r.label}</span>
        <span className="tabular-nums text-muted">{sharePercent(r.views, total)}%</span>
        <span className="w-20 text-right font-bold tabular-nums">{unit(r.views)}</span>
      </div>
      <div aria-hidden="true" className="ml-9 h-1.5 rounded-full bg-paper">
        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${barPercent(r.views, max)}%` }} />
      </div>
    </li>
  );
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">{rows.slice(0, show).map((r, i) => row(r, i))}</ul>
      {rows.length > show ? (
        <details className="group">
          <summary className="tap-target inline-flex cursor-pointer items-center rounded-full border border-line px-5 text-base font-bold">{more}</summary>
          <ul className="mt-3 flex flex-col gap-3">{rows.slice(show).map((r, i) => row(r, i + show))}</ul>
        </details>
      ) : null}
    </div>
  );
}

/** One number with its name: the headline row's tiles. */
export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-3xl bg-surface p-5">
      <p className="text-base font-bold text-muted">{label}</p>
      <p className="text-4xl font-bold tabular-nums leading-none">{value}</p>
      {note ? <p className="text-base text-muted">{note}</p> : null}
    </div>
  );
}
