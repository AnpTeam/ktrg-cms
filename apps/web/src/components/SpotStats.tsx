import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ClockIcon, FlagIcon, PinIcon, RouteIcon, RulerIcon, StampIcon } from "@/components/icons";
import { PointKindName } from "@/components/PointKindName";
import { StatusWord } from "@/components/StatusWord";
import type { SpotDetail } from "@/lib/content";

/** Where a stop sits on its course: its number among the stamp places, and the walk from the stop before. */
export interface StopPlace {
  number: number;
  total: number;
  fromPrev?: { km: number; minutes: number; mode?: string };
}

/**
 * A stop's facts in the course page's icon grid (RouteStats `icons`): what it is, its number on the course, the walk from
 * the stop before, the stamp, and its status. Anything not known is left out.
 */
export function SpotStats({ spot, place }: { spot: SpotDetail; place?: StopPlace }) {
  const { t, i18n } = useLingui();
  const numbers = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const stampable = spot.stampable !== false;
  const items: { label: string; icon: ReactNode; value: ReactNode }[] = [];
  if (spot.kind) items.push({ label: t`種類`, icon: <PinIcon />, value: <PointKindName kind={spot.kind} /> });
  if (stampable && place) {
    const { number, total } = place;
    items.push({ label: t`順番`, icon: <RouteIcon />, value: t`${number} / ${total}か所` });
  }
  if (place?.fromPrev) {
    const km = numbers.format(place.fromPrev.km);
    const minutes = place.fromPrev.minutes;
    items.push({ label: t`前の場所から`, icon: <RulerIcon />, value: t`${km}km` });
    // A ferry or a bus between two stops is not walking.
    items.push({ label: place.fromPrev.mode ? t`移動の時間` : t`歩く時間`, icon: <ClockIcon />, value: t`約${minutes}分` });
  }
  items.push({
    label: t`スタンプ`,
    icon: <StampIcon />,
    value: !stampable ? t`なし` : spot.stamped ? t`押しました` : t`押せます`,
  });
  items.push({ label: t`いまの状態`, icon: <FlagIcon />, value: <StatusWord status={spot.status} /> });
  if (spot.stopBy) items.push({ label: t`道から`, icon: <RouteIcon />, value: t`寄り道` });

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(({ label, value, icon }) => (
        <div key={label} className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-brand">{icon}</span>
          <div className="min-w-0">
            <dt className="text-base leading-tight text-muted">{label}</dt>
            <dd className="text-xl font-bold leading-snug tabular-nums">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
