import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChartIcon, ClockIcon, FlagIcon, MountainIcon, RouteIcon, RulerIcon } from "@/components/icons";
import { InfoTip } from "@/components/InfoTip";
import type { RouteSummary } from "@/lib/content";
import type { WalkStyle } from "@/lib/walk-style";

type Stats = Pick<RouteSummary, "distanceKm" | "elevationGainM" | "expectedTimeMin" | "difficulty" | "physicalLevel" | "technicalLevel">;

/**
 * Distance, climb, time and difficulty. Anything the CMS has not filled in yet is simply
 * left out (skeleton routes start empty). `compact` is for the trail list: label and value
 * on one line; the default stacks a small label over a big value; `icons` puts an icon beside each (the route page);
 * `inline` is label and value side by side, inside the parent's own row (RoutePill): in a narrow container only distance and time.
 */
export function RouteStats({ route, compact = false, icons = false, inline = false, line = false, walkStyle = null, tips = !compact }: { route: Stats; compact?: boolean; icons?: boolean; inline?: boolean; /** Distance, time and the two levels as one line of words ("24.2km 5時間40分 体力度2"), for the course list. */ line?: boolean; walkStyle?: WalkStyle | null; /** The "i" beside the two levels. Off where the stats sit inside a link (the trail list). */ tips?: boolean }) {
  const { t, i18n } = useLingui();
  const numbers = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", {
    maximumFractionDigits: 1,
  });

  const items: { label: string; value: string; icon: ReactNode; short?: string; info?: "physical" | "technical" }[] = [];
  // How the walk goes (片道, 周回 or 往復), where the page chooses to say it: it reads as one more number of the route.
  if (walkStyle) items.push({ label: t`歩き方`, icon: <RouteIcon />, value: walkStyle === "loop" ? t`周回` : walkStyle === "out_and_back" ? t`往復` : t`片道` });
  if (route.distanceKm !== null) {
    const km = numbers.format(route.distanceKm);
    items.push({ label: t`距離`, icon: <RulerIcon />, value: t`${km}km` });
  }
  if (route.elevationGainM !== null) {
    const meters = numbers.format(route.elevationGainM);
    items.push({ label: t`のぼり`, icon: <MountainIcon />, value: t`${meters}m` });
  }
  if (route.expectedTimeMin !== null) {
    const hours = Math.floor(route.expectedTimeMin / 60);
    const minutes = route.expectedTimeMin % 60;
    items.push({
      label: t`時間`,
      icon: <ClockIcon />,
      value: hours > 0 && minutes > 0 ? t`${hours}時間${minutes}分` : hours > 0 ? t`${hours}時間` : t`${minutes}分`,
    });
  }
  // The grading levels when they are set; otherwise the editor's own words.
  if (route.physicalLevel !== null) items.push({ label: t`体力度`, short: t`体力`, icon: <ChartIcon />, value: `${route.physicalLevel}`, info: "physical" });
  if (route.technicalLevel !== null) items.push({ label: t`技術度`, short: t`技術`, icon: <FlagIcon />, value: route.technicalLevel, info: "technical" });
  if (route.physicalLevel === null && route.technicalLevel === null && route.difficulty) items.push({ label: t`難しさ`, icon: <ChartIcon />, value: route.difficulty });

  const tip = (info: "physical" | "technical" | undefined) =>
    info === "physical" ? (
      <InfoTip label={t`体力度とは`} href="/grading#physical">
        {t`歩く時間・距離・登りと下りから、必要な体力を1（やさしい）から10（とても大変）で表した目安です。`}
      </InfoTip>
    ) : info === "technical" ? (
      <InfoTip label={t`技術度とは`} href="/grading#technical">
        {t`道の険しさや迷いやすさを、A（整った道）からE（厳しい岩場や藪）で表した目安です。`}
      </InfoTip>
    ) : null;

  if (items.length === 0) return null;

  if (line) {
    const parts = items.filter((i) => i.info || i.label === t`距離` || i.label === t`時間`).map((i) => (i.info ? `${i.label}${i.value}` : i.value));
    // Spaced, not dotted: when it wraps no separator is left at the start of a line.
    return (
      <p className="flex flex-wrap gap-x-4 text-base font-bold tabular-nums">
        {parts.map((part) => (
          <span key={part}>{part}</span>
        ))}
      </p>
    );
  }

  if (inline) {
    return (
      <dl className="contents">
        {items.map(({ label, value, icon, short }) => (
          <div key={label} className={`items-center gap-1 ${label === t`距離` || label === t`時間` ? "flex" : "hidden @2xl:flex"}`}>
            {/* English words are too long for this row: an icon, or a short word where an icon alone says too little. The full word stays for screen readers and on hover. */}
            {i18n.locale === "ja" ? (
              <dt className="font-bold text-accent">{label}</dt>
            ) : short ? (
              <dt title={label} className="font-bold text-accent">
                <span aria-hidden="true">{short}</span>
                <span className="sr-only">{label}</span>
              </dt>
            ) : (
              <dt title={label} className="shrink-0 text-brand [&_svg]:size-5">
                {icon}
                <span className="sr-only">{label}</span>
              </dt>
            )}
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (icons) {
    // Icon, then a small label over the value, in even columns so the rows line up: two to a row, three where there is room.
    return (
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-x-4 gap-y-3">
        {items.map(({ label, value, icon, info }) => (
          <div key={label} className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-brand">{icon}</span>
            <div className="min-w-0">
              <dt className="text-base leading-tight text-muted">
                {label}
                {tips ? tip(info) : null}
              </dt>
              <dd className="whitespace-nowrap text-xl font-bold leading-snug tabular-nums">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    );
  }

  if (compact) {
    // One row of small label-over-value pairs; on a narrow phone it wraps to a second row instead of being squeezed.
    return (
      <dl className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map(({ label, value, info }) => (
          <div key={label}>
            <dt className="text-base leading-tight text-muted">
              {label}
              {tips ? tip(info) : null}
            </dt>
            <dd className="text-base font-bold leading-snug tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="mt-4 grid grid-cols-2 gap-3">
      {items.map(({ label, value, info }) => (
        <div key={label} className="rounded-2xl bg-surface px-4 py-3">
          <dt className="text-base text-muted">
            {label}
            {tips ? tip(info) : null}
          </dt>
          <dd className="text-2xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
