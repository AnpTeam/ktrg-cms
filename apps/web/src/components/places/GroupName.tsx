"use client";

import { useGroupNames } from "@/components/map/PlacesPanel";
import type { PlaceGroup } from "@/lib/places";

/** A group's name in the visitor's language, for server pages (the names live in a client hook). */
export function GroupName({ group }: { group: PlaceGroup }) {
  return <>{useGroupNames()[group]}</>;
}
