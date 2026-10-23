"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { PlaceDialog } from "@/components/PlaceDialog";
import { useCategoryNames, useDistanceText } from "@/components/map/PlacesPanel";
import type { MapPlace, PlaceCategory } from "@/lib/places";

export interface NearestItem {
  place: MapPlace;
  meters: number;
  /** The course whose big map shows this place; null when it is on none. */
  mapRouteId: string | null;
}

export interface NearestGroup {
  category: PlaceCategory;
  items: NearestItem[];
}

/**
 * 最寄り: the nearest stations, bus stops and parking, one tab for each, nearest first with the straight-line distance. A
 * place opens in a small window (it has no page of its own), with a link to the big map when it is on one.
 */
export function NearestPlaces({ groups }: { groups: NearestGroup[] }) {
  const { t } = useLingui();
  const names = useCategoryNames();
  const distance = useDistanceText();
  const [tab, setTab] = useState<PlaceCategory>(groups[0]?.category ?? "station");
  const [open, setOpen] = useState<NearestItem | null>(null);
  const active = groups.find((g) => g.category === tab) ?? groups[0];
  if (!active) return null;
  const category = names[active.category];

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={t`最寄り`} className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.category}
            type="button"
            role="tab"
            aria-selected={g.category === active.category}
            onClick={() => setTab(g.category)}
            className={`tap-target rounded-full px-5 text-base font-bold ${g.category === active.category ? "bg-ink text-paper" : "border border-line bg-paper text-muted"}`}
          >
            {names[g.category]}
          </button>
        ))}
      </div>
      {active.items.length === 0 ? (
        <p className="text-lg">{t`近くに${category}はありません。`}</p>
      ) : (
        <ul role="tabpanel" className="flex flex-col">
          {active.items.map((item) => (
            <li key={item.place.id} className="border-t border-line/30 first:border-t-0">
              <button type="button" onClick={() => setOpen(item)} className="tap-target flex w-full items-baseline justify-between gap-3 py-3 text-left">
                <span lang={item.place.nameLang} className="min-w-0 text-lg font-bold leading-snug">
                  {item.place.name}
                </span>
                <span className="shrink-0 text-lg tabular-nums">{distance(item.meters)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <PlaceDialog
        place={open?.place ?? null}
        meters={open?.meters ?? null}
        mapHref={open?.mapRouteId ? `/map?route=${encodeURIComponent(open.mapRouteId)}&place=${encodeURIComponent(open.place.id)}` : null}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
