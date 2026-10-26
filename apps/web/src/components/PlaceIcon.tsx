import { placeIconSvg } from "@/lib/place-icons";
import type { PlaceCategory } from "@/lib/places";

/** The coloured picture of a kind of place (see lib/place-icons.ts), on a white disc so it reads in any theme. */
export function PlaceIcon({ category, size = 28 }: { category: PlaceCategory; size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size} focusable="false" dangerouslySetInnerHTML={{ __html: placeIconSvg[category] }} />
    </span>
  );
}
