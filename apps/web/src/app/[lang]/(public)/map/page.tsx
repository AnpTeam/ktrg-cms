import type { Metadata } from "next";
import { cookies } from "next/headers";
import { msg } from "@lingui/core/macro";
import { MapScreen } from "@/components/map/MapScreen";
import { forViewer, getRoute, getSpot, listRoutes, pickText, type RouteSummary } from "@/lib/content";
import type { MapScreenRoute, MapScreenStop } from "@/lib/map-screen";
import { mapSettingsCookie, parseMapSettings } from "@/lib/map-settings";
import { isStampMock } from "@/lib/stamp-flow";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer, type Viewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`マップ`) };
}

type Translate = (path: string) => string;

/**
 * What the map needs for each course. The detailed map (path, stops, what a stop's sheet says) is prepared
 * only for courses whose stops have positions, which today is the one draft course; the rest show their area.
 * TODO(WBS 2.2.1): when the API exists, load a course's detail when it is chosen instead of for all of them.
 */
async function mapRoutes(routes: RouteSummary[], viewer: Viewer, locale: string, to: Translate, words: { stamped: string; closed: string }): Promise<MapScreenRoute[]> {
  return Promise.all(
    [...routes]
      .sort((a, b) => a.order - b.order)
      .map(async (r): Promise<MapScreenRoute> => {
        const name = pickText(locale, r.nameJa, r.nameEn);
        let stops: MapScreenStop[] | null = null;
        let line: MapScreenRoute["line"] = null;
        let draft = false;

        if (r.status === "ready" && r.spotCount > 0) {
          const found = await getRoute(r.id);
          const detail = found ? forViewer(found, viewer) : null;
          const positioned = detail?.spots.filter((s) => s.position) ?? [];
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
                    stamped: spot.stamped,
                    status: s.status,
                    href: to(`/spots/${s.id}`),
                    description: full ? (pickText(locale, full.descriptionJa, full.descriptionEn)?.text ?? null) : null,
                    statusNote: note?.text ?? null,
                    statusUpdatedAt: full?.statusUpdatedAt ?? null,
                  };
                }),
              )
            ).filter((s): s is MapScreenStop => s !== null);
          }
        }

        return {
          id: r.id,
          order: r.order,
          name: name?.text ?? r.nameJa,
          nameLang: name?.lang ?? "ja",
          prefecture: r.prefecture,
          municipality: r.municipality,
          distanceKm: r.distanceKm,
          elevationGainM: r.elevationGainM,
          expectedTimeMin: r.expectedTimeMin,
          difficulty: r.difficulty,
          status: r.status,
          spotCount: r.spotCount,
          stampedCount: r.stampedCount,
          area: r.area,
          elevations: r.sketch?.elevations ?? null,
          href: to(`/routes/${r.id}`),
          stops,
          line,
          draft,
        };
      }),
  );
}

// The map tab (WBS 3.2.10): all 19 courses as areas, with a bottom sheet that keeps the map in view. Anyone can look
// around; stamps and navigation are for accounts.
export default async function MapPage({ searchParams }: { searchParams: Promise<{ as?: string; stamp?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const to: Translate = (path) => localePath(i18n.locale, path);
  const { stamp } = await searchParams;
  // Development only: `?stamp=far` and so on pretends the answers of the stamping API, which does not exist yet.
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;

  const prefs = await getPrefs();
  const settings = parseMapSettings((await cookies()).get(mapSettingsCookie)?.value);
  const summaries = (await listRoutes()).map((r) => forViewer(r, viewer));
  const routes = await mapRoutes(summaries, viewer, i18n.locale, to, { stamped: i18n._(msg`スタンプ済み`), closed: i18n._(msg`閉鎖中`) });
  const next = `?next=${encodeURIComponent(to("/map"))}`;

  return (
    <MapScreen
      routes={routes}
      settings={settings}
      mergeStops={prefs.mergeStops}
      signedIn={viewer.signedIn}
      locale={i18n.locale}
      loginHref={`${to("/login")}${next}`}
      registerHref={`${to("/register")}${next}`}
      stampMock={stampMock}
    />
  );
}
