import type { ComponentProps } from "react";
import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { pickText, type SpotDetail } from "@/lib/content";
import { HeroPhoto } from "./map/HeroPhoto";
import { Localized } from "./Localized";
import { NearbyPlaces, type Nearby } from "./NearbyPlaces";
import { LastUpdated } from "@/components/LastUpdated";
import { NearestPlaces, type NearestGroup } from "./NearestPlaces";
import { Notice } from "./Notice";
import { RichText } from "./RichText";
import { SpotGallery } from "./SpotGallery";
import { StampFace } from "./StampFace";
import { StampHere } from "./StampHere";
import { StatusBanner } from "./StatusBanner";
import type { StampMock } from "@/lib/stamp-flow";

import { buttonStyle } from "@/components/button";
/**
 * The spot detail sheet (WBS 3.2.5). Presentational on purpose: today it is the
 * body of /spots/[id]; the map's bottom sheet (3.2.10) will render the same thing.
 * The big stamp button at the bottom stays in view while the page scrolls (`StampHere`, WBS 3.3.1): it reads the
 * phone's position once and asks the server, which decides. A signed-out visitor gets a real link to log in.
 */
export function SpotSheet({
  spot,
  locale,
  loginHref,
  stampMock,
  stampProgress,
  nearby = [],
  nearest = [],
}: {
  spot: SpotDetail;
  locale: string;
  loginHref: string;
  /** What is around the place (toilets, shops ...), nearest first. */
  nearby?: Nearby[];
  /** The nearest stations, bus stops and parking, a tab for each. */
  nearest?: NearestGroup[];
  /** Development only: pretend answers for the stamp button. */
  stampMock?: StampMock;
  /** Where the spot's course stood before this stamp, for the "stamp collected" popup. */
  stampProgress?: ComponentProps<typeof StampHere>["progress"];
}) {
  // A place without a stamp has a page to read, but no stamp card and no stamp button.
  const stampable = spot.stampable !== false;
  const description = pickText(locale, spot.descriptionJa, spot.descriptionEn);
  const history = pickText(locale, spot.historyJa ?? null, spot.historyEn ?? null);
  const source = pickText(locale, spot.sourceJa ?? null, spot.sourceEn ?? null);
  const gallery = spot.gallery ?? [];

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

      {spot.photoUrl ? (
        <div className="px-4">
          <HeroPhoto photo={{ src: spot.photoUrl, alt: pickText(locale, spot.nameJa, spot.nameEn)?.text ?? spot.nameJa, credit: spot.photoCredit ?? null }} placeholder={false} />
        </div>
      ) : null}

      {/* Only a place with a (checked) position can be shown on the map; the map opens on this course and this stop. */}
      {spot.position ? (
        <div className="px-4">
          <Link
            href={`${"/map"}?route=${encodeURIComponent(spot.routeId)}&stop=${encodeURIComponent(spot.id)}`}
            className={buttonStyle("secondary", "md", "inline-flex")}
          >
            <Trans>地図で見る</Trans>
          </Link>
        </div>
      ) : null}

      <StatusBanner
        status={spot.status}
        noteJa={spot.statusNoteJa}
        noteEn={spot.statusNoteEn}
        updatedAt={spot.statusUpdatedAt}
        locale={locale}
      />

      {stampable ? (
      <section className="mx-4 flex items-center gap-4 rounded-3xl bg-surface p-4">
        <StampFace state="empty" image={spot.stampImageUrl} className="h-14 w-14 shrink-0 rounded-full!" />
        <div>
          <p className="text-xl font-bold">
            <Trans>スタンプの場所</Trans>
          </p>
          <p className="text-lg text-muted">
            <Trans>押し方: 場所の近くで、ボタンを押します（位置情報）</Trans>
          </p>
        </div>
      </section>
      ) : null}

      {stampable && spot.stamped !== null ? (
        <section className="flex items-center gap-4 px-4">
          <StampFace state={spot.stamped ? "stamped" : "empty"} image={spot.stampImageUrl} rough className="h-14 w-14 shrink-0" />
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
          <div className="mt-2 max-w-prose whitespace-pre-line text-lg leading-8">
            <RichText text={description.text} lang={description.lang} />
          </div>
          {description.fallback ? (
            <p className="mt-2 text-base text-muted">
              <Trans>この説明は日本語のみです。</Trans>
            </p>
          ) : null}
        </section>
      ) : null}

      {history ? (
        <section className="px-4">
          <h2 className="text-xl font-bold">
            <Trans>歴史・由来</Trans>
          </h2>
          <div className="mt-2 max-w-prose whitespace-pre-line text-lg leading-8">
            <RichText text={history.text} lang={history.lang} />
          </div>
          {history.fallback ? (
            <p className="mt-2 text-base text-muted">
              <Trans>この説明は日本語のみです。</Trans>
            </p>
          ) : null}
        </section>
      ) : null}

      {source ? (
        <section className="px-4">
          <h2 className="text-xl font-bold">
            <Trans>出典</Trans>
          </h2>
          <div className="mt-2 max-w-prose whitespace-pre-line text-base leading-7 text-muted">
            <RichText text={source.text} lang={source.lang} />
          </div>
        </section>
      ) : null}

      {gallery.length > 0 ? (
        <section className="px-4">
          <h2 className="mb-2 text-xl font-bold">
            <Trans>写真</Trans>
          </h2>
          <SpotGallery photos={gallery} alt={pickText(locale, spot.nameJa, spot.nameEn)?.text ?? spot.nameJa} />
        </section>
      ) : null}

      {nearby.length > 0 ? (
        <section className="mx-4 rounded-3xl bg-surface p-4">
          <h2 className="mb-1 text-xl font-bold">
            <Trans>まわりにあるもの</Trans>
          </h2>
          <NearbyPlaces places={nearby} />
        </section>
      ) : null}

      {nearest.length > 0 ? (
        <section className="mx-4 rounded-3xl bg-surface p-4">
          <h2 className="mb-2 text-xl font-bold">
            <Trans>最寄り</Trans>
          </h2>
          <NearestPlaces groups={nearest} />
        </section>
      ) : null}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
      <LastUpdated iso={spot.updatedAt} locale={locale} className="px-4" />

      {stampable ? (
        <StampHere spotId={spot.id} status={spot.status} alreadyStamped={spot.stamped === true} stampImage={spot.stampImageUrl} loginHref={loginHref} mock={stampMock} progress={stampProgress} />
      ) : null}
    </article>
  );
}
