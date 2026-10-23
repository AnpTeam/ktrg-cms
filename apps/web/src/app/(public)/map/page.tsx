import { isGuidanceOnly, journeyOf, roleLabel, stopNumbers, stopRoles, trailStops } from "@/lib/route-stops";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { MapScreen } from "@/components/map/MapScreen";
import { forViewer, getRoute, sampleContentEnabled, listPlaces, listRoutes, pickText, type PlaceItem, type RouteSummary } from "@/lib/content";
import type { MapPhoto, MapScreenPoint, MapScreenRoute, MapScreenSpot, MapScreenStop } from "@/lib/map-screen";
import { categoryOfKind } from "@/lib/point-kinds";
import { getMapSettings } from "@/lib/site-settings";
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
async function mapRoutes(routes: RouteSummary[], places: PlaceItem[], viewer: Viewer, locale: string, words: { stamped: string; closed: string; start: string; goal: string }): Promise<MapScreenRoute[]> {
  return Promise.all(
    [...routes]
      .sort((a, b) => a.order - b.order)
      .map(async (r): Promise<MapScreenRoute> => {
        const name = pickText(locale, r.nameJa, r.nameEn);
        let stops: MapScreenStop[] | null = null;
        let line: MapScreenRoute["line"] = null;
        let hasLine = false;
        let sideLines: NonNullable<MapScreenRoute["sideLines"]> = [];
        let draft = false;
        let spots: MapScreenSpot[] = [];
        let photo: MapPhoto | null = null;
        let description: string | null = null;
        let history: string | null = null;
        let access: string | null = null;
        let source: string | null = null;
        let points: MapScreenPoint[] = [];

        if (r.status === "ready" && r.spotCount > 0) {
          const found = await getRoute(r.id);
          const detail = found ? forViewer(found, viewer) : null;
          const positioned = detail?.spots.filter((s) => s.position) ?? [];
          if (detail) {
            description = pickText(locale, detail.descriptionJa, detail.descriptionEn)?.text ?? null;
            history = pickText(locale, detail.historyJa, detail.historyEn)?.text ?? null;
            access = pickText(locale, detail.accessJa, detail.accessEn)?.text ?? null;
            source = pickText(locale, detail.sourceJa ?? null, detail.sourceEn ?? null)?.text ?? null;
            // The places to visit are pins of their own (below); only the guiding points stay among the small place marks.
            points = detail.points.filter((p) => isGuidanceOnly(p.kind)).flatMap((p): MapScreenPoint[] => {
              const pointName = pickText(locale, p.nameJa, p.nameEn);
              return p.position && pointName
                ? [{ id: p.id, category: categoryOfKind(p.kind), name: pointName.text, nameLang: pointName.lang, position: { lat: p.position.lat, lng: p.position.lng } }]
                : [];
            });
            photo = detail.photoUrl ? { src: detail.photoUrl, alt: name?.text ?? detail.nameJa, credit: detail.photoCredit ?? null } : null;
            const numbers = stopNumbers(detail);
            spots = detail.spots.flatMap((s): MapScreenSpot[] => {
              const spotName = pickText(locale, s.nameJa, s.nameEn);
              return spotName
                ? [{ id: s.id, order: numbers.get(s.id) ?? null, name: spotName.text, nameLang: spotName.lang, status: s.status, stamped: s.stamped, href: `/spots/${s.id}` }]
                : [];
            });
          }
          if (detail && positioned.length > 0) {
            hasLine = detail.line !== null;
            // Sample courses have no API behind them to fetch from, so theirs stays inline.
            line = sampleContentEnabled() ? detail.line : null;
            sideLines = detail.sideLines?.map((s) => s.line) ?? [];
            draft = positioned.some((s) => !s.position?.verified);
            // Each place of the course already carries what its sheet shows: no request per place.
            const trail = trailStops(detail);
            const roles = stopRoles(journeyOf(trail, detail.walkStyle ?? null));
            stops = trail
              .map((t): MapScreenStop | null => {
                const item = t.type === "stamp" ? t.spot : t.point;
                if (!item.position) return null;
                const spotName = pickText(locale, item.nameJa, item.nameEn);
                if (!spotName) return null;
                const stamped = t.type === "stamp" ? t.spot.stamped : null;
                const status = t.type === "stamp" ? t.spot.status : "open";
                const parts = [t.number === null ? spotName.text : `${t.number}. ${spotName.text}`];
                const roleWord = roleLabel(roles.get(item.id), words);
                if (roleWord) parts.push(roleWord);
                if (stamped) parts.push(words.stamped);
                if (status === "closed") parts.push(words.closed);
                const note = t.type === "stamp" ? pickText(locale, t.spot.statusNoteJa ?? null, t.spot.statusNoteEn ?? null) : null;
                return {
                  id: item.id,
                  order: t.number,
                  name: spotName.text,
                  nameLang: spotName.lang,
                  label: parts.join(", "),
                  position: { lat: item.position.lat, lng: item.position.lng },
                  kind: item.kind,
                  ...(item.stopBy ? { sideTrip: true } : {}),
                  ...(t.type === "point" ? { noStamp: true } : {}),
                  ...(roles.has(item.id) ? { role: roles.get(item.id) } : {}),
                  stamped,
                  status,
                  href: `/spots/${item.id}`,
                  description: pickText(locale, item.descriptionJa ?? null, item.descriptionEn ?? null)?.text ?? null,
                  statusNote: note?.text ?? null,
                  statusUpdatedAt: t.type === "stamp" ? t.spot.statusUpdatedAt ?? null : null,
                  photo: item.photoUrl ? { src: item.photoUrl, alt: spotName.text, credit: item.photoCredit ?? null } : null,
                };
              })
              .filter((s): s is MapScreenStop => s !== null);
          }
        }

        // The directory's places on this course (shops, toilets ...) join its navigation points.
        points = [
          ...points,
          ...places
            .filter((p) => p.routes.includes(r.order))
            .map((p): MapScreenPoint => {
              const placeName = pickText(locale, p.nameJa, p.nameEn);
              const about = pickText(locale, p.descriptionJa, p.descriptionEn)?.text ?? null;
              const hours = pickText(locale, p.hoursJa, p.hoursEn)?.text ?? null;
              return {
                id: p.id,
                category: p.category,
                name: placeName?.text ?? p.nameJa,
                nameLang: placeName?.lang ?? "ja",
                position: { lat: p.position.lat, lng: p.position.lng },
                photo: p.photoUrl ? { src: p.photoUrl, alt: placeName?.text ?? p.nameJa, credit: p.photoCredit ?? null } : null,
                description: about,
                hours,
              };
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
          physicalLevel: r.physicalLevel,
          technicalLevel: r.technicalLevel,
          status: r.status,
          spotCount: r.spotCount,
          stampedCount: r.stampedCount,
          area: r.area,
          elevations: r.sketch?.elevations ?? null,
          description,
          history,
          access,
          source,
          photo,
          gallery: galleryOf(photo, stops),
          points,
          spots,
          href: `/routes/${r.id}`,
          stops,
          line,
          hasLine,
          sideLines,
          draft,
        };
      }),
  );
}

// The map tab (WBS 3.2.10): all 19 courses as areas, with a bottom sheet that keeps the map in view. Anyone can look
// around; stamps and navigation are for accounts.
export default async function MapPage({ searchParams }: { searchParams: Promise<{ as?: string; stamp?: string; route?: string; stop?: string }> }) {
  // Everything the page needs is asked at once (each is a trip to the API): none of them waits for another.
  const [i18n, viewer, params, prefs, settings, listed, places] = await Promise.all([initLingui(), getViewer(searchParams), searchParams, getPrefs(), getMapSettings(), listRoutes(), listPlaces()]);
  const { stamp, route: wantedRoute, stop: wantedStop } = params;
  // Development only: `?stamp=far` and so on pretends the answers of the stamping API, which does not exist yet.
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;

  const summaries = listed.map((r) => forViewer(r, viewer));
  const routes = await mapRoutes(summaries, places, viewer, i18n.locale, { stamped: i18n._(msg`スタンプ済み`), closed: i18n._(msg`閉鎖中`), start: i18n._(msg`スタート`), goal: i18n._(msg`ゴール`) });
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
