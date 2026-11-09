"use client";

import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { useCategoryNames } from "@/components/map/PlacesPanel";
import { PlaceIcon } from "@/components/PlaceIcon";
import type { PlaceCategory } from "@/lib/places";

/** A place as a post's text shows it: the words already in the visitor's language. */
export interface InlinePlace {
  id: string;
  name: string;
  nameLang: "ja" | "en";
  category: PlaceCategory;
  icon?: string | null;
  hours: string | null;
}

/** A place of the directory inside a post (a ::place line): its kind, name and hours, opening its own page. */
export function PlaceInline({ place }: { place: InlinePlace }) {
  const category = useCategoryNames();
  return (
    <Link href={`/places/${place.id}`} className="flex max-w-prose items-center gap-3 rounded-3xl bg-surface p-4 no-underline hover:bg-line/20">
      <PlaceIcon category={place.category} icon={place.icon} size={32} />
      <span className="min-w-0 flex-1">
        <span lang={place.nameLang} className="block text-lg font-bold leading-snug text-ink">
          {place.name}
        </span>
        <span className="block text-base text-muted">{category[place.category]}</span>
        {place.hours ? <span className="block text-base text-ink">{place.hours}</span> : null}
      </span>
      <ChevronIcon />
    </Link>
  );
}
