import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { pickText, type SpotDetail } from "@/lib/content";
import { Localized } from "./Localized";
import { Notice } from "./Notice";
import { StampFace } from "./StampFace";
import { StatusBanner } from "./StatusBanner";

/**
 * The spot detail sheet (WBS 3.2.5). Presentational on purpose: today it is the
 * body of /spots/[id]; the map's bottom sheet (3.2.10) will render the same thing.
 * The big stamp button at the bottom stays in view while the page scrolls. Stamping itself (3.3.1) is not built
 * yet, so for a signed-in visitor the button is shown switched off with the reason, never as a control that
 * does nothing; a signed-out visitor gets a real link to log in.
 */
export function SpotSheet({ spot, locale, loginHref }: { spot: SpotDetail; locale: string; loginHref: string }) {
  const description = pickText(locale, spot.descriptionJa, spot.descriptionEn);

  return (
    <article className="flex flex-col gap-6">
      <header className="px-4">
        <h1 className="text-3xl font-bold">
          <Localized value={pickText(locale, spot.nameJa, spot.nameEn)} />
        </h1>
        <p className="mt-2 text-lg text-muted">
          <Localized value={pickText(locale, spot.routeNameJa, spot.routeNameEn)} />
        </p>
      </header>

      <StatusBanner
        status={spot.status}
        noteJa={spot.statusNoteJa}
        noteEn={spot.statusNoteEn}
        updatedAt={spot.statusUpdatedAt}
        locale={locale}
      />

      <section className="mx-4 flex items-center gap-4 rounded-3xl bg-surface p-4">
        <StampFace state="empty" className="h-14 w-14 shrink-0 rounded-full!" />
        <div>
          <p className="text-xl font-bold">
            <Trans>スタンプの場所</Trans>
          </p>
          <p className="text-lg text-muted">
            <Trans>押し方: 場所の近くで、ボタンを押します（位置情報）</Trans>
          </p>
        </div>
      </section>

      {spot.stamped !== null ? (
        <section className="flex items-center gap-4 px-4">
          <StampFace state={spot.stamped ? "stamped" : "empty"} rough className="h-14 w-14 shrink-0" />
          <p className="text-xl font-bold">
            {spot.stamped ? <Trans>スタンプを押しました</Trans> : <Trans>まだスタンプを押していません</Trans>}
          </p>
        </section>
      ) : null}

      {description ? (
        <section className="px-4">
          <h2 className="text-xl font-bold">
            <Trans>説明</Trans>
          </h2>
          {/* Editors type plain text; line breaks are kept. Never raw HTML. */}
          <p className="mt-2 max-w-prose whitespace-pre-line text-lg leading-8">
            <Localized value={description} tag={false} />
          </p>
          {description.fallback ? (
            <p className="mt-2 text-base text-muted">
              <Trans>この説明は日本語のみです。</Trans>
            </p>
          ) : null}
        </section>
      ) : null}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>

      {spot.stamped === true ? null : (
        <div className="sticky bottom-24 z-10 flex flex-col gap-2 px-4 md:bottom-6">
          {spot.stamped === null ? (
            <Link href={loginHref} className="tap-target flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-xl font-bold text-on-brand shadow-lg">
              <Trans>ログインしてスタンプを押す</Trans>
            </Link>
          ) : (
            <>
              <button
                type="button"
                disabled
                className="tap-target flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-xl font-bold text-on-brand opacity-50 shadow-lg"
              >
                <Trans>スタンプを押す</Trans>
              </button>
              <p className="rounded-xl bg-paper/95 px-3 py-1 text-center text-base text-muted">
                {spot.status === "closed" ? <Trans>この場所は、いまは閉鎖中です。</Trans> : <Trans>スタンプを押す機能は、準備中です。</Trans>}
              </p>
            </>
          )}
        </div>
      )}
    </article>
  );
}
