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
    // One tidy row, the seal and its word side by side (three columns across the page's width spread them far apart).
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-lg">
      {items.map(({ state, label }) => (
        <li key={state} className="flex items-center gap-2">
          <Seal state={state} className="size-10" />
          <span className="font-bold">{label}</span>
        </li>
      ))}
    </ul>
  );
}
