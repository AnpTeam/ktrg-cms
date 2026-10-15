import { Trans } from "@lingui/react/macro";
import { pickText, type SpotDetail } from "@/lib/content";
import { Localized } from "./Localized";
import { Notice } from "./Notice";
import { StampFace } from "./StampFace";
import { StatusBanner } from "./StatusBanner";

/**
 * The spot detail sheet (WBS 3.2.5). Presentational on purpose: today it is the
 * body of /spots/[id]; the map's bottom sheet (3.2.10) will render the same thing.
 * The "Stamp here" button is not here: it arrives with stamping (3.3.1).
 */
export function SpotSheet({ spot, locale }: { spot: SpotDetail; locale: string }) {
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

      {spot.stamped !== null ? (
        <section className="flex items-center gap-4 px-4">
          <StampFace state={spot.stamped ? "stamped" : "empty"} className="h-14 w-14 shrink-0" />
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
    </article>
  );
}
