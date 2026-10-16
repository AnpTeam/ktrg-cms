import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { Landing } from "@/components/landing/Landing";
import { Notice } from "@/components/Notice";
import { ProgressSummary } from "@/components/ProgressSummary";
import { RowLink } from "@/components/RowLink";
import { Ruby } from "@/components/Ruby";
import { forViewer, listRoutes } from "@/lib/content";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath, TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const to = (path: string) => localePath(i18n.locale, path);

  // Not signed in: the landing page for a first-time visitor. No progress is shown at all.
  if (!viewer.signedIn) return <Landing to={to} />;

  // Signed in: progress across everything that has published spots.
  const routes = (await listRoutes()).map((r) => forViewer(r, viewer));
  const stamped = routes.reduce((n, r) => n + (r.stampedCount ?? 0), 0);
  const total = routes.reduce((n, r) => n + r.spotCount, 0) || TOTAL_STAMPS;
  const name = viewer.name;

  return (
    <div className="flex flex-col gap-8">
      <section className="px-4">
        <h1 className="text-4xl font-bold leading-snug">
          <Ruby reading="かつらぎしゅげん">
            <Trans>葛城修験</Trans>
          </Ruby>
        </h1>
        {name ? (
          <p className="mt-2 text-xl font-bold">
            <Trans>{name}さん、こんにちは。</Trans>
          </p>
        ) : null}
        <p className="mt-3 text-xl">
          <Trans>歩いた場所で、スタンプを押そう。</Trans>
        </p>
      </section>

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
