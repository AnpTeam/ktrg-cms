"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { PlaceGroupIcon } from "@/components/icons";
import { PlaceDialog } from "@/components/PlaceDialog";
import { useCategoryNames } from "@/components/map/PlacesPanel";
import { groupOf, type MapPlace } from "@/lib/places";

/**
 * "Nearby places" of a route: the directory's places linked to it (parking, vending machines, toilets ...). They have no
 * page of their own: each opens in a small window with its details and a link that shows it on the big map.
 */
export function RouteNearbyPlaces({ routeId, places }: { routeId: string; places: MapPlace[] }) {
  const { t } = useLingui();
  const names = useCategoryNames();
  const [open, setOpen] = useState<MapPlace | null>(null);
  if (places.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-4 text-xl font-bold @4xl:px-0">{t`周辺の場所`}</h2>
      <ul className="mx-4 flex flex-col divide-y divide-line/30 rounded-2xl bg-surface @4xl:mx-0">
        {places.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(p)}
              className="tap-target flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="shrink-0 text-accent">
                <PlaceGroupIcon group={groupOf(p.category)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-snug" lang={p.nameLang}>
                  {p.name}
                </span>
                <span className="block text-base text-muted">{names[p.category]}</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-xl text-muted">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PlaceDialog place={open} mapHref={open ? `/map?route=${encodeURIComponent(routeId)}&place=${encodeURIComponent(open.id)}` : null} onClose={() => setOpen(null)} />
    </section>
  );
}
