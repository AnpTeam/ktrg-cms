import type { Metadata } from "next";
import { cookies } from "next/headers";
import { msg } from "@lingui/core/macro";
import { MapScreen } from "@/components/map/MapScreen";
import { forViewer, getRoute, getSpot, listPlaces, listRoutes, pickText, type PlaceItem, type RouteSummary } from "@/lib/content";
import type { MapPhoto, MapScreenPoint, MapScreenRoute, MapScreenSpot, MapScreenStop } from "@/lib/map-screen";
import { categoryOfKind } from "@/lib/point-kinds";
import { mapSettingsCookie, parseMapSettings } from "@/lib/map-settings";
import { municipalityName } from "@/lib/municipalities";
import { isStampMock } from "@/lib/stamp-flow";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer, type Viewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`マップ`) };
}


/** The gallery of a course: its own photo first, then the photos of its places, each address once. */
function galleryOf(photo: MapPhoto | null, stops: MapScreenStop[] | null): MapPhoto[] {
  const seen = new Set<string>();
  return [photo, ...(stops?.map((s) => s.photo) ?? [])].filter((p): p is MapPhoto => p !== null && !seen.has(p.src) && !!seen.add(p.src));
}

/**
 * What the map needs for each course. The detailed map (path, stops, what a stop's sheet says) is prepared
 * only for courses whose stops have positions, which today is the one draft course; the rest show their area.
 * TODO(WBS 2.2.1): when the API exists, load a course's detail when it is chosen instead of for all of them.
 */
async function mapRoutes(routes: RouteSummary[], places: PlaceItem[], viewer: Viewer, locale: string, words: { stamped: string; closed: string }): Promise<MapScreenRoute[]> {
  return Promise.all(
    [...routes]
      .sort((a, b) => a.order - b.order)
      .map(async (r): Promise<MapScreenRoute> => {
        const name = pickText(locale, r.nameJa, r.nameEn);
        let stops: MapScreenStop[] | null = null;
        let line: MapScreenRoute["line"] = null;
        let draft = false;
        let spots: MapScreenSpot[] = [];
        let photo: MapPhoto | null = null;
        let description: string | null = null;
        let history: string | null = null;
        let access: string | null = null;
        let points: MapScreenPoint[] = [];

        if (r.status === "ready" && r.spotCount > 0) {
          const found = await getRoute(r.id);
          const detail = found ? forViewer(found, viewer) : null;
          const positioned = detail?.spots.filter((s) => s.position) ?? [];
          if (detail) {
            description = pickText(locale, detail.descriptionJa, detail.descriptionEn)?.text ?? null;
            history = pickText(locale, detail.historyJa, detail.historyEn)?.text ?? null;
            access = pickText(locale, detail.accessJa, detail.accessEn)?.text ?? null;
            points = detail.points.flatMap((p): MapScreenPoint[] => {
              const pointName = pickText(locale, p.nameJa, p.nameEn);
              return p.position && pointName
                ? [{ id: p.id, category: categoryOfKind(p.kind), name: pointName.text, nameLang: pointName.lang, position: { lat: p.position.lat, lng: p.position.lng } }]
                : [];
            });
            photo = detail.photoUrl ? { src: detail.photoUrl, alt: name?.text ?? detail.nameJa } : null;
            spots = detail.spots.flatMap((s, index): MapScreenSpot[] => {
              const spotName = pickText(locale, s.nameJa, s.nameEn);
              return spotName
                ? [{ id: s.id, order: index + 1, name: spotName.text, nameLang: spotName.lang, status: s.status, stamped: s.stamped, href: `/spots/${s.id}` }]
                : [];
            });
          }
          if (detail && positioned.length > 0) {
            line = detail.line;
            draft = positioned.some((s) => !s.position?.verified);
            stops = (
              await Promise.all(
                detail.spots.map(async (s, index): Promise<MapScreenStop | null> => {
                  if (!s.position) return null;
                  const full = await getSpot(s.id);
                  const spot = full ? forViewer(full, viewer) : s;
                  const spotName = pickText(locale, s.nameJa, s.nameEn);
                  if (!spotName) return null;
                  const parts = [`${index + 1}. ${spotName.text}`];
                  if (spot.stamped) parts.push(words.stamped);
                  if (s.status === "closed") parts.push(words.closed);
                  const note = full ? pickText(locale, full.statusNoteJa, full.statusNoteEn) : null;
                  return {
                    id: s.id,
                    order: index + 1,
                    name: spotName.text,
                    nameLang: spotName.lang,
                    label: parts.join(", "),
                    position: { lat: s.position.lat, lng: s.position.lng },
                    kind: s.kind,
                    stamped: spot.stamped,
                    status: s.status,
                    href: `/spots/${s.id}`,
                    description: full ? (pickText(locale, full.descriptionJa, full.descriptionEn)?.text ?? null) : null,
                    statusNote: note?.text ?? null,
                    statusUpdatedAt: full?.statusUpdatedAt ?? null,
                    photo: full?.photoUrl ? { src: full.photoUrl, alt: spotName.text } : null,
                  };
                }),
              )
            ).filter((s): s is MapScreenStop => s !== null);
          }
        }

        // The directory's places on this course (shops, toilets ...) join its navigation points.
        points = [
          ...points,
          ...places
            .filter((p) => p.routes.includes(r.order))
            .map((p): MapScreenPoint => {
              const placeName = pickText(locale, p.nameJa, p.nameEn);
              return { id: p.id, category: p.category, name: placeName?.text ?? p.nameJa, nameLang: placeName?.lang ?? "ja", position: { lat: p.position.lat, lng: p.position.lng } };
            }),
        ];

        return {
          id: r.id,
          order: r.order,
          name: name?.text ?? r.nameJa,
          nameLang: name?.lang ?? "ja",
          prefecture: r.prefecture,
          municipality: municipalityName(locale, r.municipality),
          distanceKm: r.distanceKm,
          elevationGainM: r.elevationGainM,
          expectedTimeMin: r.expectedTimeMin,
          difficulty: r.difficulty,
          status: r.status,
          spotCount: r.spotCount,
          stampedCount: r.stampedCount,
          area: r.area,
          elevations: r.sketch?.elevations ?? null,
          description,
          history,
          access,
          photo,
          gallery: galleryOf(photo, stops),
          points,
          spots,
          href: `/routes/${r.id}`,
          stops,
          line,
          draft,
        };
      }),
  );
}

// The map tab (WBS 3.2.10): all 19 courses as areas, with a bottom sheet that keeps the map in view. Anyone can look
// around; stamps and navigation are for accounts.
export default async function MapPage({ searchParams }: { searchParams: Promise<{ as?: string; stamp?: string; route?: string; stop?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const { stamp, route: wantedRoute, stop: wantedStop } = await searchParams;
  // Development only: `?stamp=far` and so on pretends the answers of the stamping API, which does not exist yet.
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;

  const prefs = await getPrefs();
  const settings = parseMapSettings((await cookies()).get(mapSettingsCookie)?.value);
  const summaries = (await listRoutes()).map((r) => forViewer(r, viewer));
  const routes = await mapRoutes(summaries, await listPlaces(), viewer, i18n.locale, { stamped: i18n._(msg`スタンプ済み`), closed: i18n._(msg`閉鎖中`) });
  const next = `?next=${encodeURIComponent("/map")}`;
  // "Show in the map" from a place page: only an existing course (and a stop of it) is taken over from the address.
  const initialRoute = routes.find((r) => r.id === wantedRoute) ?? null;
  const initialStop = initialRoute?.stops?.find((s) => s.id === wantedStop) ?? null;

  return (
    <MapScreen
      initialRouteId={initialRoute?.id ?? null}
      initialStopId={initialStop?.id ?? null}
      routes={routes}
      settings={settings}
      mergeStops={prefs.mergeStops}
      signedIn={viewer.signedIn}
      locale={i18n.locale}
      loginHref={`/login${next}`}
      registerHref={`/register${next}`}
      stampMock={stampMock}
    />
  );
}
