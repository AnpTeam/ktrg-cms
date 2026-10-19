import type { RoutePoint } from "./content";
import { categoryOfKind } from "./point-kinds";
import { pickText } from "./pick-text";
import type { MapPlace } from "./places";

/**
 * A route's navigation points (turns, toilets, water ...) as map places, so they appear next to the shops and rest
 * areas on the route's map. A point without a position cannot be drawn and is left out. Pure.
 */
export function pointsAsPlaces(points: readonly RoutePoint[], locale: string): MapPlace[] {
  return points.flatMap((p) => {
    if (!p.position) return [];
    const name = pickText(locale, p.nameJa, p.nameEn);
    return [
      {
        id: p.id,
        category: categoryOfKind(p.kind),
        name: name?.text ?? p.nameJa,
        nameLang: name?.lang ?? "ja",
        hours: null,
        closedDays: null,
        description: pickText(locale, p.descriptionJa, p.descriptionEn)?.text ?? null,
        status: "open",
        position: { lat: p.position.lat, lng: p.position.lng },
        verified: p.position.verified,
        lastVerified: null,
      },
    ];
  });
}
