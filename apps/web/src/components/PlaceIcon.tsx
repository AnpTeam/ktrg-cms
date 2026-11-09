import { groupPictureCategory, placePicture } from "@/lib/place-icons";
import type { PlaceCategory, PlaceGroup } from "@/lib/places";

/** The coloured picture of a place (see lib/place-icons.ts): the one chosen for it, else its kind's, on a white disc so it reads in any theme. */
export function PlaceIcon({ category, icon, size = 28 }: { category: PlaceCategory; icon?: string | null; size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size} focusable="false" dangerouslySetInnerHTML={{ __html: placePicture(category, icon) }} />
    </span>
  );
}

/** The picture of a group of places (toilets and rest, shops and food ...), drawn from one of its kinds. */
export function PlaceGroupPicture({ group, size }: { group: PlaceGroup; size?: number }) {
  return <PlaceIcon category={groupPictureCategory[group]} size={size} />;
}
