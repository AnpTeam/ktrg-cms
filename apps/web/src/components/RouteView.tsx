import { Trans } from "@lingui/react/macro";
import { ElevationProfile } from "@/components/ElevationProfile";
import { EmptyState } from "@/components/EmptyState";
import { ExpandableText } from "@/components/ExpandableText";
import { IntroVideo } from "@/components/IntroVideo";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PrefectureName } from "@/components/PrefectureName";
import { RichText } from "@/components/RichText";
import { RouteJourney } from "@/components/RouteJourney";
import { RouteSilhouette } from "@/components/RouteSketch";
import { RouteStats } from "@/components/RouteStats";
import { StopList } from "@/components/StopList";
import { TripSummary } from "@/components/TripSummary";
import { HeroPhoto } from "@/components/map/HeroPhoto";
import type { MapStop } from "@/components/map/TrailMap";
import { TrailMapLoader } from "@/components/map/TrailMapLoader";
import type { RouteDetail } from "@/lib/content";
import type { MapSettings } from "@/lib/map-settings";
import { municipalityName } from "@/lib/municipalities";
import { pickText } from "@/lib/pick-text";
import { pointsAsPlaces } from "@/lib/point-places";
import { isGuidanceOnly, journeyOf, trailStops } from "@/lib/route-stops";
import type { MapPlace } from "@/lib/places";
import { parseVideoUrl } from "@/lib/video";

/** Stops that have a position become map markers, numbered by their place in the list. */
export function buildStops(
  route: RouteDetail,
  locale: string,
  spotHref: (id: string) => string,
  labels: { stamped: string; closed: string },
): MapStop[] {
  // Every place along the walk is a pin, numbered by its index (a side trip has none). A place without a stamp is a square pin.
  return trailStops(route).flatMap((stop): MapStop[] => {
    const item = stop.type === "stamp" ? stop.spot : stop.point;
    if (!item.position) return [];
    const name = pickText(locale, item.nameJa, item.nameEn);
    if (!name) return [];
    const stamped = stop.type === "stamp" ? stop.spot.stamped : null;
    const status = stop.type === "stamp" ? stop.spot.status : "open";
    const parts = [stop.number === null ? name.text : `${stop.number}. ${name.text}`];
    if (stamped) parts.push(labels.stamped);
    if (status === "closed") parts.push(labels.closed);
    return [
      {
        id: item.id,
        order: stop.number,
        name: name.text,
        label: parts.join(", "),
        nameLang: name.lang,
        position: { lat: item.position.lat, lng: item.position.lng },
        stamped,
        status,
        href: spotHref(item.id),
        ...(item.stopBy ? { sideTrip: true } : {}),
        ...(stop.type === "point" ? { noStamp: true } : {}),
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
 * and the places (stamp places numbered, the others marked "no stamp") as a trail. The public page and the admin's live preview both render this, so what an
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
  const source = pickText(locale, route.sourceJa ?? null, route.sourceEn ?? null);
  // The places to visit are pins of their own; only the guiding points (turns, dangers) stay among the small place marks.
  const mapPlaces = [...places, ...pointsAsPlaces(route.points.filter((p) => isGuidanceOnly(p.kind)), locale)];
  const trail = trailStops(route);
  const journey = journeyOf(trail, route.walkStyle ?? null);
  const photo = route.photoUrl ? { src: route.photoUrl, alt: pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa, credit: route.photoCredit ?? null } : null;

  // One column (the phone, and the admin's narrow preview). When the box this sits in is wide (a desktop page), two
  // columns: the photo, the name and the numbers, the story and the access on the left; the elevation, the video, the map
  // and the stops on the right. It follows the width of its own box (a container query), not the screen's, so the preview
  // beside the admin form stays one column. In one column the order is the one for walking (each part's `order-n`): the
  // photo, the name, the summary card, then the map and the places; the story comes after. The two wrappers are
  // `contents` there, so they take no space of their own.
  const SIDE = "contents @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-6";
  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-6 @4xl:grid @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @4xl:items-start @4xl:gap-x-10">
        <div className={SIDE}>
          {photo ? (
            <div className="order-1 px-4 @4xl:order-none @4xl:px-0">
              <HeroPhoto photo={photo} placeholder={false} />
            </div>
          ) : null}
          <header className="order-2 px-4 @4xl:order-none @4xl:px-0">
            <div className="flex items-start justify-between gap-4">
              <h1 className="min-w-0 text-3xl font-bold @4xl:text-4xl">
                <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
              </h1>
              {route.sketch ? <RouteSilhouette sketch={route.sketch} size={96} /> : null}
            </div>
            {route.prefecture || route.municipality ? (
              <p className="mt-2 text-lg text-muted">
                {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
                {route.prefecture && route.municipality ? " " : null}
                {municipalityName(locale, route.municipality)}
              </p>
            ) : null}
            {/* The phone has the summary card below instead. */}
            <div className="hidden @4xl:block">
              <RouteStats route={route} />
            </div>
          </header>

          <div className="order-3 @4xl:order-none">
            <TripSummary route={route} journey={journey} locale={locale} />
          </div>

          {description ? (
            <section className="order-8 px-4 @4xl:order-none @4xl:px-0">
              <ExpandableText text={description.text} className="max-w-prose whitespace-pre-line text-lg leading-8">
                <RichText text={description.text} lang={description.lang} />
              </ExpandableText>
            </section>
          ) : null}

          {history ? (
            <section className="order-10 px-4 @4xl:order-none @4xl:px-0">
              <h2 className="text-xl font-bold">
                <Trans>歴史・由来</Trans>
              </h2>
              <div className="mt-2">
                <ExpandableText text={history.text} className="max-w-prose whitespace-pre-line text-lg leading-8">
                  <RichText text={history.text} lang={history.lang} />
                </ExpandableText>
              </div>
              {history.fallback ? (
                <p className="mt-2 text-base text-muted">
                  <Trans>この文章は日本語のみです。</Trans>
                </p>
              ) : null}
            </section>
          ) : null}

          {source ? (
            <section className="order-11 px-4 @4xl:order-none @4xl:px-0">
              <h2 className="text-xl font-bold">
                <Trans>出典</Trans>
              </h2>
              <div className="mt-2 max-w-prose whitespace-pre-line text-base leading-7 text-muted">
                <RichText text={source.text} lang={source.lang} />
              </div>
            </section>
          ) : null}

          {access || journey ? (
            <section className="order-7 flex flex-col gap-4 px-4 @4xl:order-none @4xl:px-0">
              <h2 className="text-xl font-bold">
                <Trans>アクセス・交通</Trans>
              </h2>
              {journey ? <RouteJourney journey={journey} locale={locale} /> : null}
              {access ? (
                <div>
                  <ExpandableText text={access.text} className="max-w-prose whitespace-pre-line text-lg leading-8">
                    <RichText text={access.text} lang={access.lang} />
                  </ExpandableText>
                  {access.fallback ? (
                    <p className="mt-2 text-base text-muted">
                      <Trans>この文章は日本語のみです。</Trans>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className={SIDE}>
          {route.sketch?.elevations ? (
            <section className="order-6 px-4 @4xl:order-none @4xl:px-0">
              <ElevationProfile elevations={route.sketch.elevations} distanceKm={route.distanceKm} />
            </section>
          ) : null}

          {video ? (
            <section className="order-9 flex flex-col gap-3 px-4 @4xl:order-none @4xl:px-0">
              <h2 className="text-xl font-bold">
                <Trans>ルートの動画</Trans>
              </h2>
              <IntroVideo video={video} title={pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa} />
            </section>
          ) : null}

          {stops.length > 0 ? (
            <section className="order-4 px-4 @4xl:order-none @4xl:px-0">
              <TrailMapLoader stops={stops} line={route.line} sideLines={route.sideLines?.map((s) => s.line)} places={mapPlaces} draft={draftPositions} settings={settings} mergeStops={mergeStops} placesFirst={placesFirst} />
            </section>
          ) : null}

          {trail.length === 0 ? (
            <div className="order-5 @4xl:order-none">
              <EmptyState title={<Trans>スタンプの場所は、まだ準備中です。</Trans>}>
                <Trans>公開できるようになったら、ここに場所の一覧が表示されます。</Trans>
              </EmptyState>
            </div>
          ) : (
            <section className="order-5 @4xl:order-none">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 pb-2 @4xl:px-0">
                <h2 className="text-xl font-bold">
                  <Trans>経由地</Trans>
                </h2>
                {stampedCount !== null && spotCount > 0 ? (
                  <p className="text-lg font-bold tabular-nums">
                    <Trans>
                      スタンプ {stampedCount} / {spotCount}
                    </Trans>
                  </p>
                ) : null}
              </div>
              <div className="px-4 @4xl:px-0">
                <StopList stops={trail} hrefFor={spotHref} locale={locale} />
              </div>
            </section>
          )}
        </div>
      </div>

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}
