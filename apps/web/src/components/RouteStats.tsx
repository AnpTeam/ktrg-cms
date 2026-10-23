import { useLingui } from "@lingui/react/macro";
import type { RouteSummary } from "@/lib/content";
import type { WalkStyle } from "@/lib/walk-style";

type Stats = Pick<RouteSummary, "distanceKm" | "elevationGainM" | "expectedTimeMin" | "difficulty" | "physicalLevel" | "technicalLevel">;

/**
 * Distance, climb, time and difficulty. Anything the CMS has not filled in yet is simply
 * left out (skeleton routes start empty). `compact` is for the trail list: label and value
 * on one line; the default stacks a small label over a big value (route page).
 */
export function RouteStats({ route, compact = false, walkStyle = null }: { route: Stats; compact?: boolean; walkStyle?: WalkStyle | null }) {
  const { t, i18n } = useLingui();
  const numbers = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", {
    maximumFractionDigits: 1,
  });

  const items: { label: string; value: string }[] = [];
  // How the walk goes (片道, 周回 or 往復), where the page chooses to say it: it reads as one more number of the route.
  if (walkStyle) items.push({ label: t`歩き方`, value: walkStyle === "loop" ? t`周回` : walkStyle === "out_and_back" ? t`往復` : t`片道` });
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
  // The grading levels when they are set; otherwise the editor's own words.
  if (route.physicalLevel !== null) items.push({ label: t`体力度`, value: `${route.physicalLevel}` });
  if (route.technicalLevel !== null) items.push({ label: t`技術度`, value: route.technicalLevel });
  if (route.physicalLevel === null && route.technicalLevel === null && route.difficulty) items.push({ label: t`難しさ`, value: route.difficulty });

  if (items.length === 0) return null;

  if (compact) {
    // One row of small label-over-value pairs; on a narrow phone it wraps to a second row instead of being squeezed.
    return (
      <dl className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-base leading-tight text-muted">{label}</dt>
            <dd className="text-base font-bold leading-snug tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="mt-4 grid grid-cols-2 gap-3">
      {items.map(({ label, value }) => (
        <div key={label} className="rounded-2xl bg-surface px-4 py-3">
          <dt className="text-base text-muted">{label}</dt>
          <dd className="text-2xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
