import { Trans } from "@lingui/react/macro";
import Link from "next/link";
import { ProgressSummary } from "@/components/ProgressSummary";
import { ContinueCard } from "@/components/landing/ContinueCard";
import { Landing } from "@/components/landing/Landing";
import { listBanners, slidesToShow } from "@/lib/banners";
import { getRoute, listRoutes, pickText, sampleContentEnabled, type RouteSummary } from "@/lib/content";
import { listNotices } from "@/lib/notices";
import { homeTextFor } from "@/lib/page-text-server";
import { listPosts } from "@/lib/posts";
import { getHomeSections } from "@/lib/site-settings";
import { homeIntroVideo } from "@/lib/video";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { TOTAL_STAMPS } from "@/lib/rally";
import { nodeState } from "@/lib/ribbon";

/** The course to offer next: one that is part-way, else the first one with a stamp still to collect. */
function courseToContinue(routes: RouteSummary[]): RouteSummary | undefined {
  const ready = routes.filter((r) => r.status === "ready" && r.spotCount > 0).sort((a, b) => a.order - b.order);
  return ready.find((r) => (r.stampedCount ?? 0) > 0 && (r.stampedCount ?? 0) < r.spotCount) ?? ready.find((r) => (r.stampedCount ?? 0) < r.spotCount);
}

// The home page. Everyone sees the same sections (banners, notices, the courses, about, map, before you go); a signed-in
// visitor gets a greeting, where to go on, and their progress in place of the sign-up hero.

export default async function HomePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  // The visitor and the page's data do not depend on each other: one round of requests.
  const i18n = await initLingui();
  const [viewer, all, notices, banners, posts, sections, text] = await Promise.all([getViewer(searchParams), listRoutes(), listNotices(), listBanners(), listPosts(), getHomeSections(), homeTextFor(i18n.locale)]);
  const routes = all;
  const introVideo = homeIntroVideo();
  const slides = slidesToShow(banners, sampleContentEnabled());
  const page = { locale: i18n.locale, routes, notices, introVideo, slides, posts, showTourism: sections.tourism, text };

  const stamped = routes.reduce((n, r) => n + (r.stampedCount ?? 0), 0);
  // Someone with no account and no stamp yet gets the landing page for a first-time visitor; anyone with progress (a guest's
  // stamps are kept in the browser) gets it shown.
  if (!viewer.signedIn && stamped === 0) return <Landing {...page} />;

  const total = routes.reduce((n, r) => n + r.spotCount, 0) || TOTAL_STAMPS;
  const name = viewer.name;
  const target = courseToContinue(routes);
  const [prefs, found] = await Promise.all([getPrefs(), target ? getRoute(target.id) : undefined]);
  // The next places to stamp on that course, in order (a side trip and a closed place are left out).
  const next = found ? found.spots.filter((s) => s.stamped === false && s.status !== "closed" && !s.stopBy).slice(0, 3) : [];

  const first = next[0];
  const nextPlace = first && target ? { id: first.id, name: pickText(i18n.locale, first.nameJa, first.nameEn)?.text ?? first.nameJa, routeName: pickText(i18n.locale, target.nameJa, target.nameEn)?.text ?? target.nameJa } : null;

  const ready = routes.filter((r) => r.status === "ready");
  const badges = ready.filter((r) => nodeState({ status: r.status, stamped: r.stampedCount, total: r.spotCount }) === "complete").length;
  const tile = "tap-target flex flex-col items-center justify-center gap-1 rounded-3xl bg-surface px-2 py-3 text-center";

  // A dashboard: a greeting, how far along they are with the next place, three numbers that each lead somewhere, and the
  // course to go on with. The banners (current events) come above it (Landing puts them first when there is a dashboard).
  const top = (
    <div className="flex flex-col gap-5 pt-2 wide:grid wide:grid-cols-2 wide:items-start wide:gap-x-8">
      <h1 className="px-4 text-2xl font-bold leading-snug wide:col-span-2">
        {name ? <Trans>{name}さん、こんにちは。</Trans> : <Trans>おかえりなさい。</Trans>}
      </h1>

      <div className="mx-4 rounded-3xl bg-surface py-5 wide:col-start-1 wide:row-start-2">
        <ProgressSummary stamped={stamped} total={total} next={nextPlace} />
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 wide:col-start-1 wide:row-start-3">
        <Link href="/rallies" className={tile}>
          <span className="text-base text-muted"><Trans>ラリー</Trans></span>
          <span className="text-2xl font-bold tabular-nums text-accent">{stamped}<span className="text-lg text-muted"> / {total}</span></span>
        </Link>
        <Link href="/badges" className={tile}>
          <span className="text-base text-muted"><Trans>バッジ</Trans></span>
          <span className="text-2xl font-bold tabular-nums text-accent">{badges}<span className="text-lg text-muted"> / {ready.length}</span></span>
        </Link>
        <Link href="/bookmarks" className={tile}>
          <span className="text-base text-muted"><Trans>ブックマーク</Trans></span>
          <span className="text-2xl font-bold tabular-nums text-accent">{viewer.bookmarks.length}</span>
        </Link>
      </div>

      {target ? (
        <div className="wide:col-start-2 wide:row-span-2 wide:row-start-2">
          <ContinueCard route={target} next={next} locale={i18n.locale} />
        </div>
      ) : null}

      {prefs.setupDone ? null : (
        <Link href="/welcome" className="tap-target mx-4 flex flex-col rounded-3xl bg-surface p-5 wide:col-span-2 wide:row-start-4">
          <span className="text-xl font-bold text-accent">
            <Trans>見やすさを設定しませんか</Trans>
          </span>
          <span className="mt-1 text-lg">
            <Trans>文字やボタンの大きさ、地図の見せ方を選べます。</Trans>
          </span>
        </Link>
      )}
    </div>
  );

  return <Landing {...page} top={top} />;
}
