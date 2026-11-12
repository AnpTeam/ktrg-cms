"use client";

import { useLingui } from "@lingui/react/macro";
import { PlaceIcon } from "@/components/PlaceIcon";
import { useCategoryNames, useStatusNames } from "@/components/map/PlacesPanel";
import type { PlaceCategory, PlaceStatus } from "@/lib/places";

export interface PlaceFactsData {
  category: PlaceCategory;
  icon?: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  closedDays: string | null;
  website: string | null;
  status: PlaceStatus;
  /** Already written out in the visitor's language, or null. */
  checked: string | null;
}

/** The details of a directory place as a plain table (what a visitor needs before going): name, kind, address, hours ... */
export function PlaceFacts({ place }: { place: PlaceFactsData }) {
  const { t } = useLingui();
  const category = useCategoryNames();
  const status = useStatusNames();
  const rows: [string, React.ReactNode][] = [
    [t`名前`, place.name],
    [t`種類`, category[place.category]],
    ...(place.address ? ([[t`住所`, place.address]] as [string, React.ReactNode][]) : []),
    ...(place.phone ? ([[t`電話番号`, <a key="tel" href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className="font-bold text-accent underline underline-offset-4">{place.phone}</a>]] as [string, React.ReactNode][]) : []),
    ...(place.hours ? ([[t`営業時間`, place.hours]] as [string, React.ReactNode][]) : []),
    ...(place.closedDays ? ([[t`休業日`, place.closedDays]] as [string, React.ReactNode][]) : []),
    [t`いまの状態`, place.checked ? `${status[place.status]}（${place.checked}）` : status[place.status]],
    ...(place.website ? ([[t`Webサイト`, <a key="web" href={place.website} target="_blank" rel="noopener noreferrer" className="break-all font-bold text-accent underline underline-offset-4">{place.website}</a>]] as [string, React.ReactNode][]) : []),
  ];
  return (
    <div className="rounded-[1.75rem] bg-surface p-5">
      <div className="mb-3 flex items-center gap-3">
        <PlaceIcon category={place.category} icon={place.icon} size={32} />
        <p className="text-xl font-bold leading-snug">{place.name}</p>
      </div>
      <dl className="divide-y divide-line/30">
        {rows.map(([term, value]) => (
          <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-3 py-3 text-lg leading-7">
            <dt className="font-bold text-muted">{term}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
