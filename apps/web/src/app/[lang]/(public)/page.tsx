import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { Notice } from "@/components/Notice";
import { ProgressSummary } from "@/components/ProgressSummary";
import { RowLink } from "@/components/RowLink";
import { Ruby } from "@/components/Ruby";
import { initLingui } from "@/i18n/server";
import { localePath, TOTAL_ROUTES, TRAIL_KM } from "@/lib/rally";

export default async function HomePage() {
  const i18n = await initLingui();
  const to = (path: string) => localePath(i18n.locale, path);

  return (
    <div className="flex flex-col gap-8">
      <section className="px-4">
        <h1 className="text-4xl font-bold leading-snug">
          <Ruby reading="かつらぎしゅげん">
            <Trans>葛城修験</Trans>
          </Ruby>
        </h1>
        <p className="mt-3 text-xl">
          <Trans>歩いた場所で、スタンプを押そう。</Trans>
        </p>
      </section>

      {/* No account or stamp data yet, so the honest count is 0. */}
      <ProgressSummary stamped={0}>
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
