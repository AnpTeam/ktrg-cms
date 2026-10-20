import Link from "next/link";
import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { pickText } from "@/lib/content";
import { formatUpdated } from "@/lib/format";
import { isSoon, nextSlot, sealName, stampedNumbers, type RallyItem } from "@/lib/rally-model";
import { ChevronIcon } from "./icons";
import { SectionBanner } from "./SectionBanner";
import { StampGrid } from "./StampGrid";
import { StampLegend } from "./StampLegend";

const nameOf = (locale: string, ja: string, en: string | null) => pickText(locale, ja, en)?.text ?? ja;

/** A bar showing how far along a rally is. The numbers beside it say it all; the bar is a bonus. */
function Bar({ stamped, total, label }: { stamped: number; total: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={stamped}
      className="h-4 overflow-hidden rounded-full border-2 border-line bg-paper"
    >
      <div className="h-full bg-moss" style={{ width: `${(total > 0 ? stamped / total : 0) * 100}%` }} />
    </div>
  );
}

/** The rally the visitor stamped in most recently: big progress, what is left, and the stamp grid. */
export function FeaturedRally({ rally, locale, signedIn }: { rally: RallyItem; locale: string; signedIn: boolean }) {
  const { t } = useLingui();
  const stamped = rally.stamped ?? 0;
  const remaining = rally.total - stamped;
  const next = nextSlot(rally);
  const nextName = next ? nameOf(locale, next.nameJa, next.nameEn) : "";
  const total = rally.total;
  const when = rally.lastStampedAt ? formatUpdated(locale, rally.lastStampedAt) : "";

  return (
    <section className="flex flex-col gap-3 px-4">
      <SectionBanner>{signedIn && rally.lastStampedAt ? t`いまのラリー` : t`はじめのラリー`}</SectionBanner>
      <div className="frame pattern-shippo p-4">
        {signedIn && rally.lastStampedAt ? (
          <p className="text-base text-muted">{t`最後に押した日時　${when}`}</p>
        ) : null}
        <h2 className="mt-1 text-2xl font-bold leading-snug">{nameOf(locale, rally.nameJa, rally.nameEn)}</h2>
        {signedIn ? (
          <>
            <p className="mt-3 text-6xl font-bold leading-none tabular-nums text-accent">
              {stamped}
              <span className="ml-2 text-3xl text-muted">/ {rally.total}</span>
            </p>
            <p className="mt-2 text-xl font-bold">
              {remaining === 0 ? t`すべてそろいました。` : stamped === 0 ? t`まだスタンプはありません。` : t`あと${remaining}か所`}
            </p>
            <div className="mt-3">
              <Bar stamped={stamped} total={rally.total} label={t`スタンプの進み具合`} />
            </div>
            {next ? (
              <p className="mt-3 text-lg">
                <span className="text-muted">{t`つぎ`}　</span>
                <span className="font-bold">
                  {next.number}. {nextName}
                </span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-lg text-muted">{t`全${total}か所`}</p>
        )}
        {signedIn ? (
          <div className="-mx-4 mt-3">
            <StampLegend />
          </div>
        ) : null}
        <div className="mt-4">
          <StampGrid
            total={rally.total}
            stamped={stampedNumbers(rally)}
            showNext={signedIn}
            art={rally.kind === "mounds"}
            names={rally.kind === "mounds" ? new Map(rally.slots.map((slot) => [slot.number, sealName(slot.nameJa)])) : undefined}
          />
        </div>
      </div>
    </section>
  );
}

/** One rally in the list: its name and progress; open it to see every place. */
export function RallyCard({ rally, locale, signedIn }: { rally: RallyItem; locale: string; signedIn: boolean }) {
  const { t } = useLingui();
  const name = nameOf(locale, rally.nameJa, rally.nameEn);
  const order = rally.order;
  const total = rally.total;
  const kind: ReactNode = rally.kind === "mounds" ? t`経塚ラリー` : t`コース${order}`;

  if (isSoon(rally)) {
    return (
      <li className="rounded-xl border-2 border-dashed border-line p-4">
        <p className="text-base text-muted">{kind}</p>
        <p className="text-xl font-bold leading-snug">{name}</p>
        <p className="mt-1 inline-block rounded-lg border-2 border-dashed border-line px-2 text-lg font-bold text-muted">
          {t`準備中`}
        </p>
      </li>
    );
  }

  const stamped = rally.stamped ?? 0;
  return (
    <li className="rounded-3xl bg-surface">
      <details className="group">
        <summary className="tap-target flex cursor-pointer list-none flex-col gap-2 p-4 [&::-webkit-details-marker]:hidden">
          <span className="text-base text-muted">{kind}</span>
          <span className="text-xl font-bold leading-snug text-accent">{name}</span>
          <span className="flex items-center gap-3">
            {signedIn ? (
              <>
                <span className="text-2xl font-bold tabular-nums">
                  {stamped} / {rally.total}
                </span>
                <span className="min-w-0 flex-1">
                  <Bar stamped={stamped} total={rally.total} label={t`スタンプの進み具合`} />
                </span>
              </>
            ) : (
              <span className="flex-1 text-lg text-muted">{t`全${total}か所`}</span>
            )}
            <span className="shrink-0 transition-transform group-open:rotate-90">
              <ChevronIcon />
            </span>
          </span>
        </summary>
        {rally.kind === "mounds" ? (
          <div className="border-t-2 border-line p-4">
            <StampGrid
              total={rally.total}
              stamped={stampedNumbers(rally)}
              showNext={signedIn}
              art
              names={new Map(rally.slots.map((slot) => [slot.number, sealName(slot.nameJa)]))}
            />
          </div>
        ) : null}
        <ol className="border-t-2 border-line">
          {rally.slots.map((slot) => (
            <li key={slot.id} className="flex items-center gap-3 border-b-2 border-line px-4 py-3 last:border-b-0">
              <span
                aria-hidden="true"
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums ${
                  slot.stamped ? "bg-shu text-on-shu" : "border-2 border-dashed border-line text-muted"
                }`}
              >
                {slot.number}
              </span>
              <span className="min-w-0 flex-1 text-lg leading-snug">{nameOf(locale, slot.nameJa, slot.nameEn)}</span>
              {slot.stamped === null ? null : (
                <span className={`shrink-0 text-lg font-bold ${slot.stamped ? "text-moss" : "text-muted"}`}>
                  {slot.stamped ? t`押した` : t`まだ`}
                </span>
              )}
            </li>
          ))}
        </ol>
        {rally.routeId ? (
          <div className="border-t-2 border-line p-4">
            <Link
              href={`/routes/${rally.routeId}`}
              className="tap-target inline-flex items-center rounded-lg border border-ink px-4 text-lg font-bold text-accent hover:bg-paper"
            >
              <Trans>コースを見る</Trans>
            </Link>
          </div>
        ) : null}
      </details>
    </li>
  );
}
