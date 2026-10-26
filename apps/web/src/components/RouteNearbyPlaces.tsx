"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { PlaceIcon } from "@/components/PlaceIcon";
import { PlaceDialog } from "@/components/PlaceDialog";
import { PlaceChips, useCategoryNames } from "@/components/map/PlacesPanel";
import { groupOf, placeGroups, type MapPlace, type PlaceGroup } from "@/lib/places";

/**
 * "Nearby places" of a route: the directory's places linked to it (parking, vending machines, toilets ...). They have no
 * page of their own: each opens in a small window with its details and a link that shows it on the big map.
 */
export function RouteNearbyPlaces({ routeId, places }: { routeId: string; places: MapPlace[] }) {
  const { t } = useLingui();
  const names = useCategoryNames();
  const [open, setOpen] = useState<MapPlace | null>(null);
  // The kinds shown: all at first; a button turns a kind off (and on again).
  const [active, setActive] = useState<ReadonlySet<PlaceGroup>>(() => new Set(placeGroups));
  if (places.length === 0) return null;
  const counts: Partial<Record<PlaceGroup, number>> = {};
  for (const p of places) counts[groupOf(p.category)] = (counts[groupOf(p.category)] ?? 0) + 1;
  const shown = places.filter((p) => active.has(groupOf(p.category)));
  const toggle = (group: PlaceGroup) =>
    setActive((now) => {
      const next = new Set(now);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-4 text-xl font-bold @4xl:px-0">{t`周辺の場所`}</h2>
      <div className="mx-4 @4xl:mx-0">
        <PlaceChips counts={counts} active={active} onToggle={toggle} label={t`表示する種類`} />
      </div>
      {shown.length === 0 ? <p className="mx-4 text-lg text-muted @4xl:mx-0">{t`ボタンを押して、見たい種類を選んでください。`}</p> : null}
      <ul hidden={shown.length === 0} className="mx-4 flex flex-col divide-y divide-line/30 rounded-2xl bg-surface @4xl:mx-0">
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(p)}
              className="tap-target flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <PlaceIcon category={p.category} />
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
