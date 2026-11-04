import { useLingui } from "@lingui/react/macro";
import { elevationArea } from "@/lib/sketch";
import { ElevationChart } from "./ElevationChart";

const W = 300;
const H = 120;
const PAD = 4;

/**
 * The climb along the route (WBS 3.2.8): a filled profile with the highest and lowest points in words, and the
 * distance under it. The readings are spread evenly along the line (the CMS keeps a simplified profile, not one
 * point per metre), so the shape is right but the horizontal scale is approximate. The drawing is hidden from
 * screen readers and replaced by one sentence with the same numbers.
 */
export function ElevationProfile({
  elevations,
  distanceKm,
  routeLine,
  lineElevations,
}: {
  elevations: readonly number[];
  distanceKm: number | null;
  /** The route's own line with an elevation for each point: the interactive chart is drawn from it when it is there. */
  routeLine?: readonly { lat: number; lng: number }[] | null;
  lineElevations?: readonly (number | null)[] | null;
}) {
  const { t, i18n } = useLingui();
  if (routeLine && lineElevations && routeLine.length === lineElevations.length) return <ElevationChart line={routeLine} elevations={lineElevations} />;
  const area = elevationArea(elevations, W, H, PAD);
  if (!area) return null;

  const lowest = Math.round(Math.min(...elevations));
  const highest = Math.round(Math.max(...elevations));
  const numbers = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const withUnit = (value: number) => {
    const km = numbers.format(value);
    return t`${km}km`;
  };
  // The top edge of the filled area, without the closing run along the bottom.
  const line = area.replace(/ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ Z$/, "");

  return (
    <figure className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-xl font-bold">{t`標高のようす`}</span>
        <span className="flex gap-4 text-lg tabular-nums">
          <span>{t`最高 ${highest}m`}</span>
          <span>{t`最低 ${lowest}m`}</span>
        </span>
      </figcaption>
      <div role="img" aria-label={t`標高は${lowest}mから${highest}mまで`}>
        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-32 w-full">
          <line x1={PAD} x2={W - PAD} y1={PAD} y2={PAD} className="stroke-line" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} className="fill-moss/25" />
          <path d={line} fill="none" className="stroke-moss" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div aria-hidden="true" className="flex justify-between text-base text-muted tabular-nums">
        <span>{withUnit(0)}</span>
        {distanceKm !== null ? <span>{withUnit(distanceKm)}</span> : null}
      </div>
    </figure>
  );
}
