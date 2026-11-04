import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import { SectionBanner } from "@/components/SectionBanner";
import { gsiTileListUrl } from "@/lib/map";
import { rectangleRing } from "@/lib/map-screen";
import type { RouteSummary } from "@/lib/content";

// A small picture of where all the courses lie: GSI tiles as the background (plain images, no script, so it stays light
// on a weak signal) with each course's area as an outlined box and its number on top. The button opens the real map.

const PAD = 40;
const TILE = 256;
/** About this many pixels across: it decides the zoom, and so how many tiles are fetched. */
const TARGET_W = 960;

// Web Mercator, in pixels of the whole world at zoom z (the same maths the tiles use).
const worldX = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const worldY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

export function LandingMap({ routes }: { routes: RouteSummary[] }) {
  const { t } = useLingui();
  const boxes = routes.flatMap((r) => (r.area ? [{ order: r.order, ring: rectangleRing(r.area) }] : []));
  if (boxes.length === 0) return null;

  const all = boxes.flatMap((b) => b.ring);
  const west = Math.min(...all.map((p) => p.lng));
  const east = Math.max(...all.map((p) => p.lng));
  const south = Math.min(...all.map((p) => p.lat));
  const north = Math.max(...all.map((p) => p.lat));
  const z = Math.min(14, Math.max(5, Math.floor(Math.log2(TARGET_W / Math.max(1e-6, worldX(east, 0) - worldX(west, 0))))));
  const x = (lng: number) => worldX(lng, z);
  const y = (lat: number) => worldY(lat, z);
  const [left, top] = [x(west) - PAD, y(north) - PAD];
  const [W, H] = [Math.round(x(east) - x(west) + 2 * PAD), Math.round(y(south) - y(north) + 2 * PAD)];
  const tiles: { key: string; href: string; x: number; y: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + W) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + H) / TILE); ty++)
      tiles.push({ key: `${tx}/${ty}`, href: `https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${tx}/${ty}.png`, x: tx * TILE, y: ty * TILE });
  const count = boxes.length;

  return (
    <section className="flex flex-col gap-3 lg:col-span-2">
      <div className="px-4">
        <SectionBanner>
          <Trans>全体の地図</Trans>
        </SectionBanner>
      </div>
      <div className="mx-4 rounded-3xl bg-surface p-5">
        <svg viewBox={`${left} ${top} ${W} ${H}`} role="img" aria-label={t`全${count}区間のある場所を示した図`} className="h-auto max-h-[80svh] w-full rounded-2xl bg-paper">
          {tiles.map((tile) => (
            <image key={tile.key} href={tile.href} x={tile.x} y={tile.y} width={TILE} height={TILE} />
          ))}
          {boxes.map((b) => (
            <polygon
              key={b.order}
              points={b.ring.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(" ")}
              className="fill-brand/25 stroke-accent"
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
        <p className="mt-1 text-sm text-muted">
          <a href={gsiTileListUrl} target="_blank" rel="noopener noreferrer" className="underline">
            <Trans>国土地理院（地理院タイル）</Trans>
          </a>
        </p>
        <Link href="/map" className="tap-target mt-4 flex min-h-14 items-center justify-center rounded-xl border border-ink bg-surface px-6 text-xl font-bold text-ink hover:bg-paper">
          <Trans>マップをひらく</Trans>
        </Link>
      </div>
    </section>
  );
}
