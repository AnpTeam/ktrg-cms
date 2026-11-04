import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Localized } from "@/components/Localized";
import { EmptyState } from "@/components/EmptyState";
import { initLingui } from "@/i18n/server";
import { listRoutes, pickText } from "@/lib/content";
import { nodeState } from "@/lib/ribbon";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`バッジ`) };
}

// One badge for each course: it is earned when every stamp place of the course is stamped. The progress comes from the
// visitor's own stamps (an account's, or a guest's kept in the browser), so everyone sees theirs.
export default async function BadgesPage() {
  const i18n = await initLingui();
  const routes = (await listRoutes()).filter((r) => r.status === "ready");
  const states = routes.map((r) => nodeState({ status: r.status, stamped: r.stampedCount, total: r.spotCount }));
  const earned = states.filter((s) => s === "complete").length;

  return (
    <div className="flex flex-col gap-6 pt-2 lg:pt-0">
      <div className="flex flex-col gap-2 px-4">
        <BackLink href="/rallies">
          <Trans>ラリー</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold lg:text-4xl">
          <Trans>バッジ</Trans>
        </h1>
        <p className="text-2xl font-bold tabular-nums text-accent">
          {earned} / {routes.length}
        </p>
        <p className="max-w-prose text-lg leading-8">
          <Trans>コースのすべての場所でスタンプを押すと、そのコースのバッジがもらえます。</Trans>
        </p>
      </div>

      {routes.length === 0 ? (
        <EmptyState title={<Trans>バッジは、まだ準備中です。</Trans>}>
          <Trans>公開できるようになったら、ここにコースのバッジが表示されます。</Trans>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3">
          {routes.map((r, i) => {
            const done = states[i] === "complete";
            return (
              <li key={r.id}>
                <Link href={`/routes/${r.id}`} className="tap-target flex h-full flex-col items-center gap-2 rounded-3xl bg-surface p-4 text-center">
                  <span
                    aria-hidden="true"
                    className={`flex size-24 items-center justify-center rounded-full text-4xl font-bold tabular-nums ${
                      done
                        ? "bg-shu text-on-shu shadow-[inset_0_0_0_4px_var(--color-shu),inset_0_0_0_7px_var(--color-on-shu)]"
                        : "border-4 border-dashed border-line text-muted"
                    }`}
                  >
                    {r.order}
                  </span>
                  <span className="text-lg font-bold leading-snug">
                    <Localized value={pickText(i18n.locale, r.nameJa, r.nameEn)} tag={false} />
                  </span>
                  <span className="text-base font-bold text-muted">
                    {done ? <Trans>もらいました</Trans> : <span className="tabular-nums">{r.stampedCount ?? 0} / {r.spotCount}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
