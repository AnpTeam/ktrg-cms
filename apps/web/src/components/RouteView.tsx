import type { ReactNode } from "react";
import Image from "next/image";
import { Trans } from "@lingui/react/macro";
import { ElevationProfile } from "@/components/ElevationProfile";
import { EmptyState } from "@/components/EmptyState";
import { ExpandableText } from "@/components/ExpandableText";
import { Ruby, RubyParts } from "@/components/Ruby";
import { AccessList } from "@/components/AccessList";
import { FileVideoPlayer } from "@/components/FileVideo";
import { IntroVideo } from "@/components/IntroVideo";
import { LastUpdated } from "@/components/LastUpdated";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PlaceLine } from "@/components/PlaceLine";
import { RichText } from "@/components/RichText";
import { RouteJourney } from "@/components/RouteJourney";
import { RouteStats } from "@/components/RouteStats";
import { StopList } from "@/components/StopList";
import { BookmarkButton } from "@/components/BookmarkButton";
import { CoverWatch } from "@/components/CoverWatch";
import { CreditToggle } from "@/components/PhotoCredit";
import type { MapStop } from "@/components/map/TrailMap";
import { TrailMapLoader } from "@/components/map/TrailMapLoader";
import type { RouteDetail } from "@/lib/content";
import type { MapSettings } from "@/lib/map-settings";
import { municipalityName } from "@/lib/municipalities";
import { pickText } from "@/lib/pick-text";
import { parseRuby, textOfRuby } from "@/lib/ruby";
import { pointsAsPlaces } from "@/lib/point-places";
import { isGuidanceOnly, journeyOf, roleLabel, stopRoles, trailStops, walkRows } from "@/lib/route-stops";
import type { MapPlace } from "@/lib/places";
import { parseVideoFile, parseVideoUrl } from "@/lib/video";

/** Stops that have a position become map markers, numbered by their place in the list. */
export function buildStops(
  route: RouteDetail,
  locale: string,
  spotHref: (id: string) => string,
  labels: { stamped: string; closed: string; start: string; goal: string },
): MapStop[] {
  // Every place along the walk is a pin, numbered by its index (a side trip has none). A place without a stamp is a square pin.
  const trail = trailStops(route);
  const roles = stopRoles(journeyOf(trail, route.walkStyle ?? null));
  return trail.flatMap((stop): MapStop[] => {
    const item = stop.type === "stamp" ? stop.spot : stop.point;
    if (!item.position) return [];
    const name = pickText(locale, item.nameJa, item.nameEn);
    if (!name) return [];
    const stamped = stop.type === "stamp" ? stop.spot.stamped : null;
    const status = stop.type === "stamp" ? stop.spot.status : "open";
    const parts = [stop.number === null ? name.text : `${stop.number}. ${name.text}`];
    const roleWord = roleLabel(roles.get(item.id), labels);
    if (roleWord) parts.push(roleWord);
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
        kind: item.kind,
        stamped,
        status,
        href: spotHref(item.id),
        ...(item.stopBy ? { sideTrip: true } : {}),
        ...(stop.type === "point" ? { noStamp: true } : {}),
        ...(roles.has(item.id) ? { role: roles.get(item.id) } : {}),
      },
    ];
  });
}

export interface RouteViewProps {
  route: RouteDetail;
  locale: string;
  places: MapPlace[];
  settings: MapSettings;
  mergeStops: boolean;
  placesFirst: boolean;
  labels: { stamped: string; closed: string; start: string; goal: string };
  /** Where a place's own page is. The admin's preview points these at nothing. */
  spotHref: (id: string) => string;
  /** Something for visitors only, shown under the elevation profile (the offline map). The admin's preview leaves it out. */
  offline?: ReactNode;
  /** Trail notices for this route: right under the name and the numbers (safety first, but after the cover). */
  notices?: ReactNode;
  /** Offer the bookmark button (visitors only; the admin's preview leaves it out). */
  bookmarkable?: boolean;
  /** The name of the "jump to a part" bar, for screen readers (a string: it is an attribute). */
  jumpLabel?: string;
  /** Show "スタンプ 3 / 14" over the walk: only for a visitor who has stamped somewhere (the admin's preview leaves it out). */
  showStampCount?: boolean;
}

/**
 * The body of a route page: header with stat tiles, elevation profile, the guidance video when there is one, the map
 * and the places (stamp places numbered, the others marked "no stamp") as a trail. The public page and the admin's live preview both render this, so what an
 * editor sees while typing is what visitors get. It reads no cookies and calls no server API.
 */
export function RouteView({ route, locale, places, settings, mergeStops, placesFirst, labels, spotHref, offline, notices, showStampCount = false, jumpLabel = "", bookmarkable = false }: RouteViewProps) {
  const description = pickText(locale, route.descriptionJa, route.descriptionEn);
  const stops = buildStops(route, locale, spotHref, labels);
  const draftPositions = route.spots.some((s) => s.position && !s.position.verified);
  const title = pickText(locale, route.nameJa, route.nameEn);
  const rubyOn = !!title && title.lang === "ja" && !title.fallback && !!route.nameKana;
  // A reading written per kanji is used when it spells this very name; an old one-reading-for-all is shown over the whole name.
  const perKanji = rubyOn ? parseRuby(route.nameKana!) : null;
  const rubyParts = perKanji && title && textOfRuby(perKanji) === title.text ? perKanji : null;
  const ruby = rubyOn && !perKanji && !route.nameKana!.includes("{") ? { text: title!.text, reading: route.nameKana! } : null;
  // The English site shows the English video when the route has one, and the Japanese video otherwise.
  const englishVideo = locale === "en" && !!route.videoUrlEn;
  const videoSource = englishVideo ? (route.videoUrlEn ?? null) : route.videoUrl;
  const video = parseVideoUrl(videoSource);
  const videoFile = video ? null : parseVideoFile(videoSource);
  const { stampedCount, spotCount } = route;
  const history = pickText(locale, route.historyJa, route.historyEn);
  const access = pickText(locale, route.accessJa, route.accessEn);
  const source = pickText(locale, route.sourceJa ?? null, route.sourceEn ?? null);
  // The places to visit are pins of their own; only the guiding points (turns, dangers) stay among the small place marks.
  const mapPlaces = [...places, ...pointsAsPlaces(route.points.filter((p) => isGuidanceOnly(p.kind)), locale)];
  const trail = trailStops(route);
  const journey = journeyOf(trail, route.walkStyle ?? null);
  const rows = walkRows(trail, journey, route.line);
  const jumps = [
    trail.length > 0 ? { id: "walk", label: <Trans>道のり</Trans> } : null,
    stops.length > 0 ? { id: "map", label: <Trans>地図</Trans> } : null,
    video || videoFile ? { id: "video", label: <Trans>動画</Trans> } : null,
    access || journey || route.accessPoints.length > 0 ? { id: "access", label: <Trans>行き方</Trans> } : null,
  ].filter((j) => j !== null);
  const photo = route.photoUrl ? { src: route.photoUrl, alt: pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa, credit: route.photoCredit ?? null } : null;

  // One column (the phone, and the admin's narrow preview). When the box this sits in is wide (a desktop page), two
  // columns: the photo, the name and the numbers, the story and the access on the left; the elevation, the video, the map
  // and the stops on the right. It follows the width of its own box (a container query), not the screen's, so the preview
  // beside the admin form stays one column. In one column the order is the one for deciding and walking (each part's
  // `order-n`): the cover with the name and the numbers, the short description, the walk from start to goal, the map
  // and the climb; access, the video and the story come after. The two wrappers are
  // `contents` there, so they take no space of their own.
  const SIDE = "contents @4xl:flex @4xl:min-w-0 @4xl:flex-col @4xl:gap-6";
  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-6 @4xl:grid @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @4xl:items-start @4xl:gap-x-10">
        <div className={SIDE}>
          {/* The cover: in one column the photo runs edge to edge and fades into the page at the bottom, and the name sits on the
              fade, so photo and title read as one. In two columns it is a plain framed photo with the name under it. */}
          {photo ? (
            // data-cover: on a phone the top bar goes see-through and this photo runs up behind it to the top of the screen; in the
            // installed app it also runs behind the Dynamic Island while it is in view (CoverWatch, globals.css).
            <div data-cover className="relative order-1 aspect-[4/3] w-full overflow-hidden bg-surface @4xl:order-none @4xl:aspect-video @4xl:rounded-2xl">
              <Image src={photo.src} alt={photo.alt} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" unoptimized={photo.src.startsWith("https://")} />
              {/* A light veil at the top so the bar's logo and buttons stay readable on any photo (phones only, where the bar is over it). */}
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[calc(6rem+env(safe-area-inset-top))] bg-linear-to-b from-paper/80 to-transparent md:hidden" />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-paper @4xl:hidden" />
              <div className="contents [&>details]:top-[calc(4rem+env(safe-area-inset-top))] md:[&>details]:top-3">
                <CreditToggle credit={photo.credit} />
              </div>
              <CoverWatch />
            </div>
          ) : null}
          <header className={`relative order-2 px-4 @4xl:order-none @4xl:mt-0 @4xl:px-0 ${photo ? "-mt-20" : ""}`}>
            {/* In Japanese the name can carry its reading over it; the heading sits a little lower to give the reading room. */}
            <h1 className={`min-w-0 text-4xl font-bold leading-tight @4xl:text-4xl ${ruby || rubyParts ? "pt-4" : ""}`}>
              {rubyParts ? <RubyParts parts={rubyParts} /> : ruby ? <Ruby reading={ruby.reading}>{ruby.text}</Ruby> : <Localized value={title} />}
            </h1>
            {route.prefecture || route.municipality ? (
              <p className="mt-2 text-lg text-muted">
                <PlaceLine prefecture={route.prefecture} place={municipalityName(locale, route.municipality)} locale={locale} />
              </p>
            ) : null}
            <div className="mt-5">
              <RouteStats route={route} icons tips walkStyle={journey?.style ?? null} />
            </div>
            {/* Two columns have no jump bar: the bookmark sits under the numbers, with its word. */}
            {bookmarkable ? (
              <div className="mt-4 hidden @4xl:block">
                <BookmarkButton routeId={route.id} />
              </div>
            ) : null}
          </header>

          {jumps.length >= 2 || bookmarkable ? (
            // Solid background on purpose: a see-through bar at the top edge brings back iOS's status-bar blur (globals.css).
            // The bookmark, then links to the parts of a long page. It stays at the top while scrolling on a phone; two columns
            // show everything at once. The bookmark stays put while the links scroll sideways on a narrow screen.
            <nav aria-label={jumpLabel} data-scroll-hide className="sticky top-[var(--status-strip,0px)] z-20 order-3 flex items-center border-b border-line/30 bg-paper py-2 @4xl:hidden">
              {bookmarkable ? (
                <div className="shrink-0 border-r border-line pl-4 pr-3">
                  <BookmarkButton routeId={route.id} compact />
                </div>
              ) : null}
              {jumps.length >= 2 ? (
                <ul className="flex min-w-0 gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
                  {jumps.map((j) => (
                    <li key={j.id} className="shrink-0">
                      <a href={`#${j.id}`} className="tap-target inline-flex items-center rounded-full border border-line bg-paper px-4 text-lg font-bold text-ink hover:bg-surface">
                        {j.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </nav>
          ) : null}

          {notices ? <div className="order-3 flex flex-col gap-3 @4xl:order-none @4xl:[&>section]:mx-0">{notices}</div> : null}

          {description ? (
            <section className="order-4 px-4 @4xl:order-none @4xl:px-0">
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

          {access || journey || route.accessPoints.length > 0 ? (
            <section id="access" className="order-8 flex flex-col gap-4 px-4 scroll-mt-20 @4xl:order-none @4xl:px-0">
              <h2 className="text-xl font-bold">
                <Trans>アクセス・交通</Trans>
              </h2>
              {journey ? <RouteJourney journey={journey} locale={locale} /> : null}
              {route.accessPoints.length > 0 ? <AccessList points={route.accessPoints} locale={locale} /> : null}
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
            <section className="order-7 px-4 @4xl:order-none @4xl:px-0">
              <ElevationProfile elevations={route.sketch.elevations} distanceKm={route.distanceKm} routeLine={route.line} lineElevations={route.lineElevations} />
            </section>
          ) : null}

          {offline ? <section className="order-7 px-4 @4xl:order-none @4xl:px-0">{offline}</section> : null}

          {video || videoFile ? (
            <section id="video" className="order-9 flex flex-col gap-3 px-4 scroll-mt-20 @4xl:order-none @4xl:px-0">
              <h2 className="text-xl font-bold">
                <Trans>ルートの動画</Trans>
              </h2>
              {video ? (
                <IntroVideo video={video} title={pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa} />
              ) : videoFile ? (
                <FileVideoPlayer key={videoFile.src} video={videoFile} subtitles={englishVideo ? route.videoSubtitlesEn === true : route.videoSubtitles === true} language={englishVideo ? "en" : "ja"} version={route.updatedAt ?? null} title={pickText(locale, route.nameJa, route.nameEn)?.text ?? route.nameJa} />
              ) : null}
              {englishVideo ? null : <LastUpdated iso={route.videoUpdatedAt} locale={locale} />}
            </section>
          ) : null}

          {stops.length > 0 ? (
            <section id="map" className="order-6 px-4 scroll-mt-20 @4xl:order-none @4xl:px-0">
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
            <section id="walk" className="order-5 scroll-mt-20 @4xl:order-none">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 pb-2 @4xl:px-0">
                <h2 className="text-xl font-bold">
                  <Trans>道のり</Trans>
                </h2>
                {showStampCount && stampedCount !== null && spotCount > 0 ? (
                  <p className="text-lg font-bold tabular-nums">
                    <Trans>
                      スタンプ {stampedCount} / {spotCount}
                    </Trans>
                  </p>
                ) : null}
              </div>
              <div className="px-4 @4xl:px-0">
                <StopList rows={rows} hrefFor={spotHref} locale={locale} />
              </div>
            </section>
          )}

        </div>
      </div>

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
      <LastUpdated iso={route.updatedAt} locale={locale} className="px-4" />
    </div>
  );
}
