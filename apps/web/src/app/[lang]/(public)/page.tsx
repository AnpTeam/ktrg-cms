import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { Landing } from "@/components/landing/Landing";
import { Notice } from "@/components/Notice";
import { ProgressSummary } from "@/components/ProgressSummary";
import { RowLink } from "@/components/RowLink";
import { Ruby } from "@/components/Ruby";
import Link from "next/link";
import { bannerSlides, slidesToShow } from "@/lib/banners";
import { forViewer, listRoutes, sampleContentEnabled } from "@/lib/content";
import { listNotices } from "@/lib/notices";
import { parseVideoUrl } from "@/lib/video";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath, TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const to = (path: string) => localePath(i18n.locale, path);

  // Not signed in: the landing page for a first-time visitor. No progress is shown at all.
  if (!viewer.signedIn) {
    const [routes, notices] = await Promise.all([listRoutes(), listNotices()]);
    // The intro video is set by the deployment (a YouTube or Vimeo link); with none, the section is left out.
    const introVideo = parseVideoUrl(process.env.INTRO_VIDEO_URL);
    const slides = slidesToShow(bannerSlides, sampleContentEnabled());
    const blogUrl = process.env.BLOG_URL ?? null;
    return (
      <Landing to={to} locale={i18n.locale} routes={routes} notices={notices} introVideo={introVideo} slides={slides} blogUrl={blogUrl} />
    );
  }

  // Signed in: progress across everything that has published spots.
  const routes = (await listRoutes()).map((r) => forViewer(r, viewer));
  const stamped = routes.reduce((n, r) => n + (r.stampedCount ?? 0), 0);
  const total = routes.reduce((n, r) => n + r.spotCount, 0) || TOTAL_STAMPS;
  const name = viewer.name;
  const prefs = await getPrefs();

  return (
    <div className="flex flex-col gap-8">
      <section className="px-4">
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

      {prefs.setupDone ? null : (
        <Link
          href={to("/welcome")}
          className="tap-target mx-4 flex flex-col rounded-3xl bg-surface p-5"
        >
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
