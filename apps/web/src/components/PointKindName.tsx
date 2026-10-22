import { useLingui } from "@lingui/react/macro";
import type { PointKind } from "@/lib/point-kinds";

/** What a waypoint is, in words (a toilet, a station ...), for the list of places on a route page. */
export function PointKindName({ kind }: { kind: PointKind }) {
  const { t } = useLingui();
  const names: Record<PointKind, string> = {
    temple: t`寺社`,
    mound: t`経塚`,
    view: t`見どころ`,
    turn: t`曲がり角`,
    danger: t`注意の場所`,
    toilet: t`トイレ`,
    rest_area: t`休憩所・東屋`,
    drinking_water: t`水場`,
    vending_machine: t`自動販売機`,
    bus_stop: t`バス停`,
    station: t`駅`,
    parking: t`駐車場`,
    other: t`その他`,
  };
  return <>{names[kind]}</>;
}
