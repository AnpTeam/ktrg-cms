import { Trans } from "@lingui/react/macro";
import Link from "next/link";
import { HomeProgress } from "@/components/landing/HomeProgress";
import { Landing } from "@/components/landing/Landing";
import { listBanners, slidesToShow } from "@/lib/banners";
import { getRoute, listRoutes, sampleContentEnabled, type RouteSummary } from "@/lib/content";
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

  const ready = routes.filter((r) => r.status === "ready");
  const badges = ready.filter((r) => nodeState({ status: r.status, stamped: r.stampedCount, total: r.spotCount }) === "complete").length;

  // The greeting over the photos; under them, on the patterned band, one section that reads as a sentence: the course to
  // go on with, its next place, its seals, and the counts as plain links (docs/design-language.md, phase 2).
  const greeting = name ? <Trans>{name}さん、こんにちは。</Trans> : <Trans>おかえりなさい。</Trans>;
  const heroBody = (
    <HomeProgress
      locale={i18n.locale}
      route={target}
      spots={found?.spots ?? []}
      stamped={stamped}
      total={total}
      badges={badges}
      readyCount={ready.length}
      bookmarks={viewer.bookmarks.length}
    />
  );

  const top = (
    <div className="flex flex-col gap-5 wide:grid wide:grid-cols-2 wide:items-start wide:gap-x-8">
      {prefs.setupDone ? null : (
        <Link href="/welcome" className="tap-target mx-4 flex flex-col rounded-3xl bg-surface p-5 wide:col-span-2">
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

  return <Landing {...page} top={top} greeting={greeting} heroBody={heroBody} />;
}
