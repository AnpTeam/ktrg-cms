"use client";

import { useLingui } from "@lingui/react/macro";
import { useCategoryNames, useDistanceText } from "@/components/map/PlacesPanel";
import type { PlaceCategory } from "@/lib/places";

export interface Nearby {
  id: string;
  name: string;
  nameLang: "ja" | "en";
  category: PlaceCategory;
  meters: number;
}

/** What is around a place: toilets, shops, vending machines ..., nearest first, each with its straight-line distance. */
export function NearbyPlaces({ places }: { places: Nearby[] }) {
  const { t } = useLingui();
  const category = useCategoryNames();
  const distance = useDistanceText();
  return (
    <ul aria-label={t`まわりの場所`} className="flex flex-col">
      {places.map((p) => (
        <li key={p.id} className="flex items-baseline justify-between gap-3 border-t border-line/30 py-3 first:border-t-0">
          <span className="min-w-0">
            <span lang={p.nameLang} className="block text-lg font-bold leading-snug">
              {p.name}
            </span>
            <span className="block text-base text-muted">{category[p.category]}</span>
          </span>
          <span className="shrink-0 text-lg tabular-nums">{distance(p.meters)}</span>
        </li>
      ))}
    </ul>
  );
}
