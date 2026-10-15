import { useLingui } from "@lingui/react/macro";
import type { RouteSummary } from "@/lib/content";

type Stats = Pick<RouteSummary, "distanceKm" | "elevationGainM" | "expectedTimeMin" | "difficulty">;

/**
 * Distance, climb, time and difficulty. Anything the CMS has not filled in yet is simply
 * left out (skeleton routes start empty). `compact` is for the trail list: label and value
 * on one line; the default stacks a small label over a big value (route page).
 */
export function RouteStats({ route, compact = false }: { route: Stats; compact?: boolean }) {
  const { t, i18n } = useLingui();
  const numbers = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", {
    maximumFractionDigits: 1,
  });

  const items: { label: string; value: string }[] = [];
  if (route.distanceKm !== null) {
    const km = numbers.format(route.distanceKm);
    items.push({ label: t`距離`, value: t`${km}km` });
  }
  if (route.elevationGainM !== null) {
    const meters = numbers.format(route.elevationGainM);
    items.push({ label: t`のぼり`, value: t`${meters}m` });
  }
  if (route.expectedTimeMin !== null) {
    const hours = Math.floor(route.expectedTimeMin / 60);
    const minutes = route.expectedTimeMin % 60;
    items.push({
      label: t`時間`,
      value: hours > 0 && minutes > 0 ? t`${hours}時間${minutes}分` : hours > 0 ? t`${hours}時間` : t`${minutes}分`,
    });
  }
  if (route.difficulty) items.push({ label: t`難しさ`, value: route.difficulty });

  if (items.length === 0) return null;

  if (compact) {
    return (
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-base leading-tight text-muted">{label}</dt>
            <dd className="text-lg font-bold leading-snug tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-base text-muted">{label}</dt>
          <dd className="whitespace-nowrap text-xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
