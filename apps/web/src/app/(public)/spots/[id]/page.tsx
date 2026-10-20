import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { SpotSheet } from "@/components/SpotSheet";
import { forViewer, getSpot, listPlaces, pickText } from "@/lib/content";
import { sortByDistance } from "@/lib/places";
import type { Nearby } from "@/components/NearbyPlaces";
import { getViewer } from "@/lib/viewer";
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
  const viewer = await getViewer(searchParams);
  // Development only: `?stamp=far` and so on pretends the answers of the stamping API, which does not exist yet.
  const { stamp } = await searchParams;
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;
  const found = await getSpot((await params).id);
  if (!found) notFound();
  const spot = forViewer(found, viewer);
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

  return (
    <div className="page-narrow flex flex-col gap-6">
      <div className="px-4">
        <BackLink href={`/routes/${spot.routeId}`}>
          <Trans>ルートにもどる</Trans>
        </BackLink>
      </div>
      <SpotSheet stampMock={stampMock} nearby={near} spot={spot} locale={i18n.locale} loginHref={`${"/login"}?next=${encodeURIComponent(`/spots/${spot.id}`)}`} />
    </div>
  );
}
