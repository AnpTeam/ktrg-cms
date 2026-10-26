import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { SpotSheet } from "@/components/SpotSheet";
import { getSpot, listPlaces, listRoutes, pickText, toMapPlace } from "@/lib/content";
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
  const { stamp } = await searchParams;
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;
  const found = await getSpot((await params).id);
  if (!found) notFound();
  const spot = found;
  // Toilets, shops and the like within a few minutes' walk, nearest first (a straight line, not the walking distance).
  const near: Nearby[] = spot.position
    ? sortByDistance(await listPlaces(), spot.position)
        .filter((p) => p.meters <= NEARBY_M)
        .slice(0, 8)
        .map((p) => {
          const name = pickText(i18n.locale, p.nameJa, p.nameEn);
          return { id: p.id, name: name?.text ?? p.nameJa, nameLang: name?.lang ?? "ja", category: p.category, meters: p.meters };
        })
    : [];

  // The nearest stations, bus stops and parking (within 5 km, five of each), for the 最寄り tabs.
  const nearest: NearestGroup[] = [];
  if (spot.position) {
    const [places, routes] = await Promise.all([listPlaces(), listRoutes()]);
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
      <SpotSheet stampMock={stampMock} nearby={near} nearest={nearest} spot={spot} locale={i18n.locale} loginHref={`${"/login"}?next=${encodeURIComponent(`/spots/${spot.id}`)}`} />
    </div>
  );
}
