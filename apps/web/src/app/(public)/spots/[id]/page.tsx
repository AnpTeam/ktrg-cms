import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { SpotSheet } from "@/components/SpotSheet";
import type { StopPlace } from "@/components/SpotStats";
import { getRoute, getSpot, listPlaces, listRoutes, pickText, toMapPlace } from "@/lib/content";
import type { NearestGroup } from "@/components/NearestPlaces";
import { sortByDistance } from "@/lib/places";
import type { Nearby } from "@/components/NearbyPlaces";
import { initLingui } from "@/i18n/server";
import { isStampMock } from "@/lib/stamp-flow";

/** How far around a place is still "around it", in metres. */
const NEARBY_M = 600;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string; stamp?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const spot = await getSpot((await params).id);
  return { title: spot ? pickText(i18n.locale, spot.nameJa, spot.nameEn)?.text : undefined };
}

// Spot detail (WBS 3.2.5). A draft or unknown spot is a 404 (the API does the same).
export default async function SpotPage({ params, searchParams }: Props) {
  const i18n = await initLingui();
  // Development only: `?stamp=far` and so on pretends the answers of the stamping API, which does not exist yet.
  const [{ stamp }, found] = await Promise.all([searchParams, params.then((p) => getSpot(p.id))]);
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;
  if (!found) notFound();
  const spot = found;
  // The places list is needed only with a position (nearby and nearest); the routes always (the stamp popup shows the course's progress).
  const [allPlaces, allRoutes, detail] = await Promise.all([spot.position ? listPlaces() : [], listRoutes(), getRoute(spot.routeId)]);
  // Its number among the course's stamp places, and the walk from the stop before (the course page works both out).
  const stamps = (detail?.spots ?? []).filter((s) => s.stampable !== false);
  const at = stamps.findIndex((s) => s.id === spot.id);
  const fromPrev = detail?.spots.find((s) => s.id === spot.id)?.fromPrev;
  const place: StopPlace | undefined = at >= 0 ? { number: at + 1, total: stamps.length, fromPrev } : fromPrev ? { number: 0, total: 0, fromPrev } : undefined;
  const course = allRoutes.find((r) => r.id === spot.routeId);
  const stampProgress = course && course.spotCount > 0 ? { rallyName: pickText(i18n.locale, course.nameJa, course.nameEn)?.text ?? course.nameJa, place: pickText(i18n.locale, spot.nameJa, spot.nameEn)?.text ?? spot.nameJa, before: course.stampedCount ?? 0, total: course.spotCount } : undefined;
  // Toilets, shops and the like within a few minutes' walk, nearest first (a straight line, not the walking distance).
  const near: Nearby[] = spot.position
    ? sortByDistance(allPlaces, spot.position)
        .filter((p) => p.meters <= NEARBY_M)
        .slice(0, 8)
        .map((p) => {
          const name = pickText(i18n.locale, p.nameJa, p.nameEn);
          return { id: p.id, name: name?.text ?? p.nameJa, nameLang: name?.lang ?? "ja", category: p.category, icon: p.icon ?? null, meters: p.meters };
        })
    : [];

  // The nearest stations, bus stops and parking (within 5 km, five of each), for the 最寄り tabs.
  const nearest: NearestGroup[] = [];
  if (spot.position) {
    const places = allPlaces;
    const routes = allRoutes;
    for (const category of ["station", "bus_stop", "parking"] as const) {
      const items = sortByDistance(places.filter((p) => p.category === category), spot.position)
        .filter((p) => p.meters <= 5000)
        .slice(0, 5)
        .map((p) => ({ place: toMapPlace(i18n.locale, p), meters: p.meters, mapRouteId: routes.find((r) => p.routes.includes(r.order))?.id ?? null }));
      nearest.push({ category, items });
    }
  }

  return (
    <div className="page-narrow flex flex-col gap-6">
      <div className="px-4">
        <BackLink href={`/routes/${spot.routeId}`}>
          <Trans>ルートにもどる</Trans>
        </BackLink>
      </div>
      <SpotSheet place={place} stampMock={stampMock} stampProgress={stampProgress} nearby={near} nearest={nearest} spot={spot} locale={i18n.locale} loginHref={`${"/login"}?next=${encodeURIComponent(`/spots/${spot.id}`)}`} />
    </div>
  );
}
