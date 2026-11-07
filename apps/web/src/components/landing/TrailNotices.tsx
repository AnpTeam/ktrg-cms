import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { ChevronIcon, ClosedIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { pickText } from "@/lib/pick-text";
import { daysBetween, formatDay, japanDay, isWebUrl } from "@/lib/format";
import type { TrailNotice } from "@/lib/notices";

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
    <path d="M10 21h4" />
  </svg>
);

/**
 * One row per notice: the title and how old it is (always in sight, CLAUDE.md), and a tap opens the rest. A closure wears a
 * red mark with the word on it, not the colour alone. `<details>` needs no script, so it also opens on a saved page.
 */
export function NoticeRows({ notices, locale }: { notices: TrailNotice[]; locale: string }) {
  const today = japanDay(new Date().toISOString());
  return (
    <ul className="divide-y divide-line">
      {notices.map((n) => {
        const checked = formatDay(locale, n.verifiedOn);
        const age = daysBetween(n.verifiedOn, today);
        const until = n.expiresOn ? formatDay(locale, n.expiresOn) : null;
        const source = pickText(locale, n.sourceNameJa, n.sourceNameEn);
        return (
          <li key={n.id}>
            <details className="group">
              <summary className="tap-target flex cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-col gap-1">
                  {n.closure ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded bg-danger px-2 py-0.5 text-base font-bold text-paper">
                      <ClosedIcon size={18} />
                      <Trans>通行止め</Trans>
                    </span>
                  ) : null}
                  <span className="text-lg font-bold leading-snug">
                    <Localized value={pickText(locale, n.titleJa, n.titleEn)} />
                  </span>
                  <span className="text-base text-muted">
                    {age === 0 ? <Trans>{checked} に確認（今日）</Trans> : <Trans>{checked} に確認（{age}日前）</Trans>}
                  </span>
                </span>
                <span className="shrink-0 text-muted transition-transform group-open:rotate-90">
                  <ChevronIcon size={22} />
                </span>
              </summary>
              <div className="flex flex-col gap-2 pb-4">
                {until ? (
                  <p className="text-base font-bold">
                    <Trans>{until} まで</Trans>
                  </p>
                ) : null}
                <p className="text-lg leading-7">
                  <Localized value={pickText(locale, n.bodyJa, n.bodyEn)} tag={false} />
                </p>
                {isWebUrl(n.sourceUrl) ? (
                  <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex w-fit items-center text-lg font-bold underline">
                    <Trans>出典: {source?.text ?? n.sourceNameJa}</Trans>
                  </a>
                ) : null}
                <p className="text-base text-muted">
                  <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
                </p>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * News from the trail, as a small strip: closures and hazards, each dated, with where it came from. `limit` keeps the
 * home page short; the rest are on /notices. Renders nothing when there are none: an empty block would only worry
 * people, and we never invent one.
 */
export function TrailNotices({ notices, locale, limit }: { notices: TrailNotice[]; locale: string; limit?: number }) {
  if (notices.length === 0) return null;
  return (
    <section className="mx-4 rounded-lg bg-surface px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-accent">
          <BellIcon />
          <Trans>お知らせ</Trans>
        </h2>
        {limit !== undefined ? (
          <Link href="/notices" className="tap-target inline-flex items-center text-base font-bold text-accent underline">
            <Trans>すべて見る</Trans>
          </Link>
        ) : null}
      </div>
      <NoticeRows notices={limit === undefined ? notices : notices.slice(0, limit)} locale={locale} />
    </section>
  );
}
