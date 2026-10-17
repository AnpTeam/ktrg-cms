import Link from "next/link";
import { cookies } from "next/headers";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { Landing } from "@/components/landing/Landing";
import { HomeMapView } from "@/components/map/HomeMapView";
import { Notice } from "@/components/Notice";
import { ProgressSummary } from "@/components/ProgressSummary";
import { RowLink } from "@/components/RowLink";
import { bannerSlides, slidesToShow } from "@/lib/banners";
import { forViewer, getRoute, getSpot, listRoutes, pickText, sampleContentEnabled, type RouteSummary } from "@/lib/content";
import type { HomeRoute, HomeStop } from "@/lib/home-map";
import { mapSettingsCookie, parseMapSettings } from "@/lib/map-settings";
import { listNotices } from "@/lib/notices";
import { isStampMock } from "@/lib/stamp-flow";
import { parseVideoUrl } from "@/lib/video";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer, type Viewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath, TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";

type Translate = (path: string) => string;

/**
 * What the home map needs for each course. The detailed map (path, stops, what a stop's sheet says) is prepared
 * only for courses whose stops have positions, which today is the one draft course; the rest show their area.
 * TODO(WBS 2.2.1): when the API exists, load a course's detail when it is chosen instead of for all of them.
 */
async function homeRoutes(routes: RouteSummary[], viewer: Viewer, locale: string, to: Translate, words: { stamped: string; closed: string }): Promise<HomeRoute[]> {
  return Promise.all(
    [...routes]
      .sort((a, b) => a.order - b.order)
      .map(async (r): Promise<HomeRoute> => {
        const name = pickText(locale, r.nameJa, r.nameEn);
        let stops: HomeStop[] | null = null;
        let line: HomeRoute["line"] = null;
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
                detail.spots.map(async (s, index): Promise<HomeStop | null> => {
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
            ).filter((s): s is HomeStop => s !== null);
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

// The home page is the map (WBS 3.2.10): all 19 courses as areas, with a bottom sheet that keeps the map in view.
// Anyone can look around; stamps and navigation are for accounts. The text of the page (what this is, notices, the
// stamp card, the first courses) is in the sheet, drawn here on the server.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ as?: string; stamp?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const to: Translate = (path) => localePath(i18n.locale, path);
  const { stamp } = await searchParams;
  // Development only: `?stamp=far` and so on pretends the answers of the stamping API, which does not exist yet.
  const stampMock = process.env.NODE_ENV !== "production" && isStampMock(stamp) ? stamp : undefined;

  const prefs = await getPrefs();
  const settings = parseMapSettings((await cookies()).get(mapSettingsCookie)?.value);
  const summaries = (await listRoutes()).map((r) => forViewer(r, viewer));
  const routes = await homeRoutes(summaries, viewer, i18n.locale, to, { stamped: i18n._(msg`スタンプ済み`), closed: i18n._(msg`閉鎖中`) });
  const next = `?next=${encodeURIComponent(to(""))}`;

  let content;
  if (!viewer.signedIn) {
    const notices = await listNotices();
    // The intro video is set by the deployment (a YouTube or Vimeo link); with none, the section is left out.
    const introVideo = parseVideoUrl(process.env.INTRO_VIDEO_URL);
    const slides = slidesToShow(bannerSlides, sampleContentEnabled());
    const blogUrl = process.env.BLOG_URL ?? null;
    content = <Landing hero={false} to={to} locale={i18n.locale} routes={summaries} notices={notices} introVideo={introVideo} slides={slides} blogUrl={blogUrl} />;
  } else {
    // Signed in: progress across everything that has published spots.
    const stamped = summaries.reduce((n, r) => n + (r.stampedCount ?? 0), 0);
    const total = summaries.reduce((n, r) => n + r.spotCount, 0) || TOTAL_STAMPS;
    content = (
      <div className="flex flex-col gap-6 pb-4">
        {prefs.setupDone ? null : (
          <Link href={to("/welcome")} className="tap-target mx-4 flex flex-col rounded-3xl bg-surface p-5">
            <span className="text-xl font-bold text-accent">
              <Trans>見やすさを設定しませんか</Trans>
            </span>
            <span className="mt-1 text-lg">
              <Trans>文字やボタンの大きさ、地図の見せ方を選べます。</Trans>
            </span>
          </Link>
        )}

        <ProgressSummary stamped={stamped} total={total}>
          <ButtonLink href={to("/stamps")}>
            <Trans>スタンプカードを見る</Trans>
          </ButtonLink>
        </ProgressSummary>

        <RowLink
          href={to("/routes")}
          title={<Trans>ルートをさがす</Trans>}
          detail={
            <Trans>
              全{TOTAL_ROUTES}区間（約{TRAIL_KM}km）
            </Trans>
          }
        />

        <Notice>
          <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
        </Notice>
      </div>
    );
  }

  return (
    <HomeMapView
      routes={routes}
      settings={settings}
      mergeStops={prefs.mergeStops}
      signedIn={viewer.signedIn}
      name={viewer.name}
      locale={i18n.locale}
      loginHref={`${to("/login")}${next}`}
      registerHref={`${to("/register")}${next}`}
      stampMock={stampMock}
    >
      {content}
    </HomeMapView>
  );
}
