import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import { SectionBanner } from "@/components/SectionBanner";
import { rectangleRing } from "@/lib/map-screen";
import type { RouteSummary } from "@/lib/content";

// A small picture of where all the courses lie: each course's area as an outlined box with its number, drawn from
// the same areas as the map tab. Not a map you can move (no tiles, no script), so it is light on a weak signal;
// the button opens the real map.

const W = 640;
const PAD = 28;

export function LandingMap({ routes }: { routes: RouteSummary[] }) {
  const { t } = useLingui();
  const boxes = routes.flatMap((r) => (r.area ? [{ order: r.order, ring: rectangleRing(r.area) }] : []));
  if (boxes.length === 0) return null;

  const all = boxes.flatMap((b) => b.ring);
  const west = Math.min(...all.map((p) => p.lng));
  const east = Math.max(...all.map((p) => p.lng));
  const south = Math.min(...all.map((p) => p.lat));
  const north = Math.max(...all.map((p) => p.lat));
  // East-west degrees are shorter than north-south ones at this latitude.
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = (W - 2 * PAD) / Math.max(1e-6, (east - west) * k);
  const H = Math.round((north - south) * scale + 2 * PAD);
  const x = (lng: number) => PAD + (lng - west) * k * scale;
  const y = (lat: number) => PAD + (north - lat) * scale;
  const count = boxes.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="px-4">
        <SectionBanner>
          <Trans>全体の地図</Trans>
        </SectionBanner>
      </div>
      <div className="mx-4 rounded-3xl bg-surface p-5">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t`全${count}区間のある場所を示した図`} className="h-auto w-full rounded-2xl bg-paper">
          {boxes.map((b) => (
            <polygon
              key={b.order}
              points={b.ring.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(" ")}
              className="fill-brand/20 stroke-accent"
              strokeWidth="1.6"
            />
          ))}
          {boxes.map((b) => {
            const cx = b.ring.reduce((n, p) => n + x(p.lng), 0) / b.ring.length;
            const cy = b.ring.reduce((n, p) => n + y(p.lat), 0) / b.ring.length;
            return (
              <g key={b.order}>
                <circle cx={cx} cy={cy} r="13" className="fill-accent stroke-paper" strokeWidth="2" />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700" className="fill-paper">
                  {b.order}
                </text>
              </g>
            );
          })}
        </svg>
        <Link href="/map" className="tap-target mt-4 flex min-h-14 items-center justify-center rounded-xl border border-ink bg-surface px-6 text-xl font-bold text-ink hover:bg-paper">
          <Trans>マップをひらく</Trans>
        </Link>
      </div>
    </section>
  );
}
