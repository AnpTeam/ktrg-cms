import { useLingui } from "@lingui/react/macro";
import { Seal } from "./Seal";
import type { StampState } from "./StampFace";

// Explains the three shapes in words, so nobody has to guess.
export function StampLegend() {
  const { t } = useLingui();
  const items: { state: StampState; label: string }[] = [
    { state: "stamped", label: t`押した` },
    { state: "empty", label: t`まだ` },
    { state: "next", label: t`つぎ` },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2 px-4 text-center text-lg">
      {items.map(({ state, label }) => (
        <li key={state} className="flex flex-col items-center gap-1">
          <Seal state={state} className="size-14" />
          <span className="font-bold">{label}</span>
        </li>
      ))}
    </ul>
  );
}
