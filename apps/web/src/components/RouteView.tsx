import { Trans } from "@lingui/react/macro";
import { ElevationProfile } from "@/components/ElevationProfile";
import { EmptyState } from "@/components/EmptyState";
import { IntroVideo } from "@/components/IntroVideo";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PrefectureName } from "@/components/PrefectureName";
import { RouteSilhouette } from "@/components/RouteSketch";
import { RouteStats } from "@/components/RouteStats";
import { StopList } from "@/components/StopList";
import { HeroPhoto } from "@/components/map/HeroPhoto";
import type { MapStop } from "@/components/map/TrailMap";
import { TrailMapLoader } from "@/components/map/TrailMapLoader";
import type { RouteDetail } from "@/lib/content";
import type { MapSettings } from "@/lib/map-settings";
import { pickText } from "@/lib/pick-text";
import { pointsAsPlaces } from "@/lib/point-places";
import type { MapPlace } from "@/lib/places";
import { parseVideoUrl } from "@/lib/video";

/** Stops that have a position become map markers, numbered by their place in the list. */
export function buildStops(
  route: RouteDetail,
  locale: string,
  spotHref: (id: string) => string,
  labels: { stamped: string; closed: string },
): MapStop[] {
  return route.spots.flatMap((spot, index) => {
    if (!spot.position) return [];
    const name = pickText(locale, spot.nameJa, spot.nameEn);
    if (!name) return [];
    const parts = [`${index + 1}. ${name.text}`];
    if (spot.stamped) parts.push(labels.stamped);
    if (spot.status === "closed") parts.push(labels.closed);
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
        href: spotHref(spot.id),
      },
    ];
  });
}

export interface RouteViewProps {
  /** Already filtered for the person looking (see forViewer). */
  route: RouteDetail;
  locale: string;
  places: MapPlace[];
  settings: MapSettings;
  mergeStops: boolean;
  placesFirst: boolean;
  labels: { stamped: string; closed: string };
  /** Where a place's own page is. The admin's preview points these at nothing. */
  spotHref: (id: string) => string;
}

/**
 * The body of a route page: header with stat tiles, elevation profile, the guidance video when there is one, the map
 * and the stamp places as a numbered trail. The public page and the admin's live preview both render this, so what an
 * editor sees while typing is what visitors get. It reads no cookies and calls no server API.
 */
export function RouteView({ route, locale, places, settings, mergeStops, placesFirst, labels, spotHref }: RouteViewProps) {
  const description = pickText(locale, route.descriptionJa, route.descriptionEn);
  const stops = buildStops(route, locale, spotHref, labels);
  const draftPositions = route.spots.some((s) => s.position && !s.position.verified);
  const video = parseVideoUrl(route.videoUrl);
  const { stampedCount, spotCount } = route;
  const history = pickText(locale, route.historyJa, route.historyEn);
  const access = pickText(locale, route.accessJa, route.accessEn);
  const mapPlaces = [...places, ...pointsAsPlaces(route.points, locale)];
  const photo = route.photoUrl ? { src: route.photoUrl, alt: pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa } : null;

  return (
    <>
      {photo ? (
        <div className="px-4">
          <HeroPhoto photo={photo} placeholder={false} />
        </div>
      ) : null}
      <header className="px-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-bold">
            <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
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
          <IntroVideo video={video} title={pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa} />
        </section>
      ) : null}

      {stops.length > 0 ? (
        <section className="px-4">
          <TrailMapLoader stops={stops} line={route.line} places={mapPlaces} draft={draftPositions} settings={settings} mergeStops={mergeStops} placesFirst={placesFirst} />
        </section>
      ) : null}

      {history ? (
        <section className="px-4">
          <h2 className="text-xl font-bold">
            <Trans>歴史・由来</Trans>
          </h2>
          <p className="mt-2 max-w-prose whitespace-pre-line text-lg leading-8">
            <Localized value={history} tag={false} />
          </p>
          {history.fallback ? (
            <p className="mt-2 text-base text-muted">
              <Trans>この文章は日本語のみです。</Trans>
            </p>
          ) : null}
        </section>
      ) : null}

      {access ? (
        <section className="px-4">
          <h2 className="text-xl font-bold">
            <Trans>アクセス・交通</Trans>
          </h2>
          <p className="mt-2 max-w-prose whitespace-pre-line text-lg leading-8">
            <Localized value={access} tag={false} />
          </p>
          {access.fallback ? (
            <p className="mt-2 text-base text-muted">
              <Trans>この文章は日本語のみです。</Trans>
            </p>
          ) : null}
        </section>
      ) : null}

      {route.spots.length === 0 ? (
        <EmptyState title={<Trans>スタンプの場所は、まだ準備中です。</Trans>}>
          <Trans>公開できるようになったら、ここに場所の一覧が表示されます。</Trans>
        </EmptyState>
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
          <StopList spots={route.spots} hrefFor={(spot) => spotHref(spot.id)} locale={locale} />
        </section>
      ) : null}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </>
  );
}
