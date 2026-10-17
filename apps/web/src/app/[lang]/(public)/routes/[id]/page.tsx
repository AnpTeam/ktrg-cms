import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PrefectureName } from "@/components/PrefectureName";
import { RouteSilhouette } from "@/components/RouteSketch";
import { RouteStats } from "@/components/RouteStats";
import { ElevationProfile } from "@/components/ElevationProfile";
import { IntroVideo } from "@/components/IntroVideo";
import { StopList } from "@/components/StopList";
import { TrailMapLoader } from "@/components/map/TrailMapLoader";
import type { MapStop } from "@/components/map/TrailMap";
import { forViewer, getRoute, listPlacesForRoute, pickText, toMapPlace } from "@/lib/content";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";
import { mapSettingsCookie, parseMapSettings } from "@/lib/map-settings";
import { parseVideoUrl } from "@/lib/video";
import { getPrefs } from "@/lib/server-prefs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const route = await getRoute((await params).id);
  return { title: route ? pickText(i18n.locale, route.nameJa, route.nameEn)?.text : undefined };
}

// Route page (WBS 3.2.4, 3.2.8): header with stat tiles, elevation profile, the guidance video when the CMS has one,
// the map, and the stamp places as a numbered trail. History text and notices are not built yet.
export default async function RouteDetailPage({ params, searchParams }: Props) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const found = await getRoute((await params).id);
  if (!found) notFound();
  const route = forViewer(found, viewer);
  const to = (path: string) => localePath(i18n.locale, path);
  const description = pickText(i18n.locale, route.descriptionJa, route.descriptionEn);

  // Stops that have a position become map markers, numbered by their place in the list.
  const stops: MapStop[] = route.spots.flatMap((spot, index) => {
    if (!spot.position) return [];
    const name = pickText(i18n.locale, spot.nameJa, spot.nameEn);
    if (!name) return [];
    const parts = [`${index + 1}. ${name.text}`];
    if (spot.stamped) parts.push(i18n._(msg`スタンプ済み`));
    if (spot.status === "closed") parts.push(i18n._(msg`閉鎖中`));
    return [
      {
        id: spot.id,
        order: index + 1,
        name: name.text,
        label: parts.join(", "),
        nameLang: name.lang,
        position: { lat: spot.position.lat, lng: spot.position.lng },
        stamped: spot.stamped,
        status: spot.status,
        href: to(`/spots/${spot.id}`),
      },
    ];
  });
  const prefs = await getPrefs();
  const settings = parseMapSettings((await cookies()).get(mapSettingsCookie)?.value);
  const places = (await listPlacesForRoute(route.order)).map((p) => toMapPlace(i18n.locale, p));
  const draftPositions = route.spots.some((s) => s.position && !s.position.verified);
  const video = parseVideoUrl(route.videoUrl);
  const { stampedCount, spotCount } = route;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4">
        <BackLink href={to("/routes")}>
          <Trans>ルート一覧</Trans>
        </BackLink>
      </div>

      <header className="px-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-bold">
            <Localized value={pickText(i18n.locale, route.nameJa, route.nameEn)} />
          </h1>
          {route.sketch ? <RouteSilhouette sketch={route.sketch} size={96} /> : null}
        </div>
        {route.prefecture || route.municipality ? (
          <p className="mt-2 text-lg text-muted">
            {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
            {route.prefecture && route.municipality ? " " : null}
            {route.municipality}
          </p>
        ) : null}
        <RouteStats route={route} />
        {description ? (
          <p className="mt-4 max-w-prose whitespace-pre-line text-lg leading-8">
            <Localized value={description} tag={false} />
          </p>
        ) : null}
      </header>

      {route.sketch?.elevations ? (
        <section className="px-4">
          <ElevationProfile elevations={route.sketch.elevations} distanceKm={route.distanceKm} />
        </section>
      ) : null}

      {video ? (
        <section className="flex flex-col gap-3 px-4">
          <h2 className="text-xl font-bold">
            <Trans>ルートの動画</Trans>
          </h2>
          <IntroVideo video={video} title={pickText(i18n.locale, route.nameJa, route.nameEn)?.text ?? route.nameJa} />
        </section>
      ) : null}

      {stops.length > 0 ? (
        <section className="px-4">
          <TrailMapLoader stops={stops} line={route.line} places={places} draft={draftPositions} settings={settings} mergeStops={prefs.mergeStops} placesFirst={prefs.placesOnMap} />
        </section>
      ) : null}

      {route.spots.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 pb-2">
            <h2 className="text-xl font-bold">
              <Trans>スタンプの場所</Trans>
            </h2>
            {stampedCount !== null ? (
              <p className="text-lg font-bold tabular-nums">
                <Trans>
                  スタンプ {stampedCount} / {spotCount}
                </Trans>
              </p>
            ) : null}
          </div>
          <StopList spots={route.spots} hrefFor={(spot) => to(`/spots/${spot.id}`)} locale={i18n.locale} />
        </section>
      ) : null}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}
