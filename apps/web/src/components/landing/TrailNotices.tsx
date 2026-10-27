import { Trans } from "@lingui/react/macro";
import { Localized } from "@/components/Localized";
import { pickText } from "@/lib/content";
import { daysBetween, formatDay, japanDay } from "@/lib/format";
import { isWebUrl, type TrailNotice } from "@/lib/notices";

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
    <path d="M10 21h4" />
  </svg>
);

/**
 * News from the trail: closures and hazards, each dated, with where it came from. It looks different from
 * the plain grey panels on purpose (a warm tint, a bell, dated rows) so it reads as news and gets noticed.
 * Renders nothing when there are none: an empty block would only worry people, and we never invent one.
 */
export function TrailNotices({ notices, locale }: { notices: TrailNotice[]; locale: string }) {
  if (notices.length === 0) return null;
  const today = japanDay(new Date().toISOString());
  return (
    <section className="mx-4 rounded-3xl bg-brand/10 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
          <BellIcon />
        </span>
        <h2 className="text-2xl font-bold text-accent">
          <Trans>お知らせ</Trans>
        </h2>
      </div>
      <ul className="mt-3 divide-y divide-brand/25">
        {notices.map((n) => {
          const checked = formatDay(locale, n.verifiedOn);
          const age = daysBetween(n.verifiedOn, today);
          const until = n.expiresOn ? formatDay(locale, n.expiresOn) : null;
          const source = pickText(locale, n.sourceNameJa, n.sourceNameEn);
          return (
            <li key={n.id} className="py-4 first:pt-2 last:pb-1">
              <p className="text-base font-bold text-accent">
                {age === 0 ? <Trans>{checked} に確認（今日）</Trans> : <Trans>{checked} に確認（{age}日前）</Trans>}
                {until ? <Trans>　{until} まで</Trans> : null}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug">
                <Localized value={pickText(locale, n.titleJa, n.titleEn)} />
              </p>
              <p className="mt-2 text-lg leading-7">
                <Localized value={pickText(locale, n.bodyJa, n.bodyEn)} tag={false} />
              </p>
              {isWebUrl(n.sourceUrl) ? (
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target mt-1 inline-flex items-center text-lg font-bold underline"
                >
                  <Trans>出典: {source?.text ?? n.sourceNameJa}</Trans>
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-base text-muted">
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </p>
    </section>
  );
}
