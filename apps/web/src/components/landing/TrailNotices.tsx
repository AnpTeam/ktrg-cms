import { Trans } from "@lingui/react/macro";
import { ChevronIcon } from "@/components/icons";
import { Localized } from "@/components/Localized";
import { pickText } from "@/lib/content";
import { formatDay } from "@/lib/format";
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
 * `blogUrl`, when set, adds a link to the blog (there is no blog in the app yet).
 */
export function TrailNotices({ notices, locale, blogUrl }: { notices: TrailNotice[]; locale: string; blogUrl: string | null }) {
  if (notices.length === 0) return null;
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
          const source = pickText(locale, n.sourceNameJa, n.sourceNameEn);
          return (
            <li key={n.id} className="py-4 first:pt-2 last:pb-1">
              <p className="text-base font-bold text-accent">
                <Trans>{checked} に確認</Trans>
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
      {blogUrl && isWebUrl(blogUrl) ? (
        <a
          href={blogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target mt-2 flex items-center justify-between gap-3 rounded-2xl bg-paper px-5 text-xl font-bold text-accent"
        >
          <Trans>ブログを見る</Trans>
          <ChevronIcon />
        </a>
      ) : null}
    </section>
  );
}
