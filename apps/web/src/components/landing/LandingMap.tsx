import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import { SectionBanner } from "@/components/SectionBanner";
import { gsiTileListUrl } from "@/lib/map";
import { rectangleRing } from "@/lib/map-screen";
import type { RouteSummary } from "@/lib/content";
import { buttonStyle } from "@/components/button";

// A picture of where all the courses lie: GSI tiles as the background (plain images, no script, so it stays light on a weak
// signal) with each course's area as an outlined box and its number standing on it. It runs from edge to edge of the page and
// is tilted with CSS, so it stays a picture: it cannot be moved or zoomed, which would only show the tiles' coarseness. The
// button opens the real map.

const PAD_X = 240;
const PAD_Y = 160;
const TILT_DEG = 50;
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
  const [left, top] = [x(west) - PAD_X, y(north) - PAD_Y];
  const [W, H] = [Math.round(x(east) - x(west) + 2 * PAD_X), Math.round(y(south) - y(north) + 2 * PAD_Y)];
  const tiles: { key: string; href: string; x: number; y: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + W) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + H) / TILE); ty++)
      tiles.push({ key: `${tx}/${ty}`, href: `https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${tx}/${ty}.png`, x: tx * TILE, y: ty * TILE });
  const count = boxes.length;

  return (
    // From 1024 px the page is a centred column: the negative margins take this back out to the edges of the area beside the sidebar.
    <section className="flex flex-col gap-3 lg:col-span-2 lg:mx-[calc((100%-100vw+var(--rail))/2)]">
      <div className="px-4 lg:mx-auto lg:w-full lg:max-w-6xl lg:px-10">
        <SectionBanner>
          <Trans>全体の地図</Trans>
        </SectionBanner>
      </div>
      <div className="relative h-80 overflow-hidden bg-paper [perspective:900px] lg:h-[28rem]">
        <div
          role="img"
          aria-label={t`全${count}区間のある場所を示した図`}
          className="absolute left-1/2 top-1/2 w-[150%] [transform-style:preserve-3d]"
          style={{ aspectRatio: `${W} / ${H}`, transform: `translate(-50%, -50%) rotateX(${TILT_DEG}deg)` }}
        >
          <svg viewBox={`${left} ${top} ${W} ${H}`} aria-hidden="true" className="absolute inset-0 size-full">
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
          </svg>
          {/* Each number stands up from the tilted map, so it stays round and readable. */}
          {boxes.map((b) => {
            const cx = b.ring.reduce((n, p) => n + x(p.lng), 0) / b.ring.length;
            const cy = b.ring.reduce((n, p) => n + y(p.lat), 0) / b.ring.length;
            return (
              <span
                key={b.order}
                aria-hidden="true"
                className="absolute grid size-7 origin-bottom place-items-center rounded-full border-2 border-paper bg-accent text-sm font-bold text-paper"
                style={{ left: `${((cx - left) / W) * 100}%`, top: `${((cy - top) / H) * 100}%`, transform: `translate(-50%, -100%) rotateX(-${TILT_DEG}deg)` }}
              >
                {b.order}
              </span>
            );
          })}
        </div>
        {/* The far edge melts into the page, and the sides and near edge meet it softly. */}
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-paper to-transparent" />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-paper to-transparent" />
        <a href={gsiTileListUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-1 right-2 rounded bg-paper/85 px-1 text-sm text-muted underline">
          <Trans>国土地理院（地理院タイル）</Trans>
        </a>
      </div>
      <div className="px-4 lg:mx-auto lg:w-full lg:max-w-6xl lg:px-10">
        <Link href="/map" className={buttonStyle("secondary", "lg", "flex")}>
          <Trans>マップをひらく</Trans>
        </Link>
      </div>
    </section>
  );
}
