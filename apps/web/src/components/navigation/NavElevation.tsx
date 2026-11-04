import { useLingui } from "@lingui/react/macro";
import type { LegProfile } from "@/lib/navigation/elevation";
import { elevationArea } from "@/lib/sketch";

const W = 300;
const H = 44;
const PAD = 3;

/** The climb between the visitor and the next stop: a small filled profile (left is where they are) and the numbers in words. */
export function NavElevation({ profile }: { profile: LegProfile }) {
  const { t } = useLingui();
  const area = elevationArea(profile.elevations, W, H, PAD);
  if (!area) return null;
  const up = Math.round(profile.climbM);
  const down = Math.round(profile.descentM);
  const words = up > 0 && down > 0 ? t`次まで 登り${up}m・下り${down}m` : up > 0 ? t`次まで 登り${up}m` : t`次まで 下り${down}m`;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-2 shadow-lg ring-1 ring-line/30">
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-10 min-w-0 flex-1">
        <path d={area} className="fill-moss/25 stroke-moss" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="shrink-0 text-base font-bold tabular-nums">{words}</p>
    </div>
  );
}
