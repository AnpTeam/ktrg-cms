"use client";

import { useId } from "react";
import { useLingui } from "@lingui/react/macro";
import { useCategoryNames } from "@/components/map/PlacesPanel";
import { PlaceIcon } from "@/components/PlaceIcon";
import { PointKindName } from "@/components/PointKindName";
import { placeCategories, type PlaceCategory } from "@/lib/places";
import { isPointKind } from "@/lib/point-kinds";

/**
 * Chooses a place's picture from tiles (the real radios are hidden, as on the text size tiles). The first tile is "none":
 * the place then wears its category's picture, which that tile shows. `options` is the list the API accepts.
 */
export function IconPicker({ label, category, value, options, onChange }: { label: string; category: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const { t } = useLingui();
  const name = useId();
  const categoryNames = useCategoryNames();
  const own = (placeCategories as readonly string[]).includes(category) ? (category as PlaceCategory) : "other";
  const tile = (on: boolean) =>
    `flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center text-base leading-tight has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
      on ? "border-brand bg-surface font-bold shadow-[inset_0_0_0_2px_var(--color-brand)]" : "border-line bg-paper"
    }`;
  const words = (key: string) => ((placeCategories as readonly string[]).includes(key) ? categoryNames[key as PlaceCategory] : isPointKind(key) ? <PointKindName kind={key} /> : key);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
      <label className={tile(value === "")}>
        <input type="radio" name={name} value="" checked={value === ""} onChange={() => onChange("")} className="sr-only" />
        <PlaceIcon category={own} size={24} />
        <span>{t`種類の絵`}</span>
      </label>
      {options.map((key) => (
        <label key={key} className={tile(value === key)}>
          <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} className="sr-only" />
          <PlaceIcon category={own} icon={key} size={24} />
          <span>{words(key)}</span>
        </label>
      ))}
    </div>
  );
}
