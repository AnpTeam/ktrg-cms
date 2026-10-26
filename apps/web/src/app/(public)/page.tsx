import { Trans } from "@lingui/react/macro";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { ProgressSummary } from "@/components/ProgressSummary";
import { Ruby } from "@/components/Ruby";
import { ContinueCard } from "@/components/landing/ContinueCard";
import { Landing } from "@/components/landing/Landing";
import { listBanners, slidesToShow } from "@/lib/banners";
import { getRoute, listRoutes, sampleContentEnabled, type RouteSummary } from "@/lib/content";
import { listNotices } from "@/lib/notices";
import { parseVideoUrl } from "@/lib/video";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { TOTAL_STAMPS } from "@/lib/rally";

/** The course to offer next: one that is part-way, else the first one with a stamp still to collect. */
function courseToContinue(routes: RouteSummary[]): RouteSummary | undefined {
  const ready = routes.filter((r) => r.status === "ready" && r.spotCount > 0).sort((a, b) => a.order - b.order);
  return ready.find((r) => (r.stampedCount ?? 0) > 0 && (r.stampedCount ?? 0) < r.spotCount) ?? ready.find((r) => (r.stampedCount ?? 0) < r.spotCount);
}

// The home page. Everyone sees the same sections (banners, notices, the courses, about, map, before you go); a signed-in
// visitor gets a greeting, where to go on, and their progress in place of the sign-up hero.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);

  const [all, notices, banners] = await Promise.all([listRoutes(), listNotices(), listBanners()]);
  const routes = all;
  // The intro video is set by the deployment (a YouTube or Vimeo link); with none, the section is left out.
  const introVideo = parseVideoUrl(process.env.INTRO_VIDEO_URL);
  const slides = slidesToShow(banners, sampleContentEnabled());
  const blogUrl = process.env.BLOG_URL ?? null;
  const page = { locale: i18n.locale, routes, notices, introVideo, slides, blogUrl };

  // Not signed in: the landing page for a first-time visitor. No progress is shown at all.
  if (!viewer.signedIn) return <Landing {...page} />;

  const stamped = routes.reduce((n, r) => n + (r.stampedCount ?? 0), 0);
  const total = routes.reduce((n, r) => n + r.spotCount, 0) || TOTAL_STAMPS;
  const name = viewer.name;
  const prefs = await getPrefs();
  const target = courseToContinue(routes);
  const found = target ? await getRoute(target.id) : undefined;
  // The next places to stamp on that course, in order (a side trip and a closed place are left out).
  const next = found ? found.spots.filter((s) => s.stamped === false && s.status !== "closed" && !s.stopBy).slice(0, 3) : [];

  const top = (
    <div className="flex flex-col gap-8 pt-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
      <section className="px-4 lg:col-start-1 lg:row-start-1">
        <div className="frame p-4">
          <h1 className="font-serif text-4xl font-bold leading-snug">
            <Ruby reading="かつらぎしゅげん">
              <Trans>葛城修験</Trans>
            </Ruby>
          </h1>
          {name ? (
            <p className="mt-2 text-xl font-bold">
              <Trans>{name}さん、こんにちは。</Trans>
            </p>
          ) : null}
          <p className="mt-3 font-serif text-xl font-bold">
            <Trans>歩いた場所で、スタンプを押そう。</Trans>
          </p>
        </div>
      </section>

      {target ? (
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <ContinueCard route={target} next={next} locale={i18n.locale} />
        </div>
      ) : null}

      {prefs.setupDone ? null : (
        <Link href="/welcome" className="tap-target mx-4 flex flex-col rounded-3xl bg-surface p-5 lg:col-span-2 lg:row-start-3">
          <span className="text-xl font-bold text-accent">
            <Trans>見やすさを設定しませんか</Trans>
          </span>
          <span className="mt-1 text-lg">
            <Trans>文字やボタンの大きさ、地図の見せ方を選べます。</Trans>
          </span>
        </Link>
      )}

      <div className="lg:col-start-1 lg:row-start-2">
        <ProgressSummary stamped={stamped} total={total}>
          <ButtonLink href="/rallies">
            <Trans>スタンプカードを見る</Trans>
          </ButtonLink>
        </ProgressSummary>
      </div>
    </div>
  );

  return <Landing {...page} top={top} />;
}
