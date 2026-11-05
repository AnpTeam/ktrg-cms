import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { CertificateButton } from "@/components/CertificateButton";
import { CreditCaption } from "@/components/PhotoCredit";
import { LastUpdated } from "@/components/LastUpdated";
import { RallyBookmark } from "@/components/RallyBookmark";
import { RallyNearbyStamp } from "@/components/RallyNearbyStamp";
import { Bar, SlotList } from "@/components/RallyViews";
import { RoutePhoto } from "@/components/RoutePhoto";
import { SectionBanner } from "@/components/SectionBanner";
import { Medal } from "@/components/Medal";
import { StampGrid } from "@/components/StampGrid";
import { StampLegend } from "@/components/StampLegend";
import { fetchPublicRally } from "@/lib/api-content";
import { listRallies, pickText } from "@/lib/content";
import { getMyStamps } from "@/lib/my-stamps";
import { isSoon, nextSlot, stampedNumbers } from "@/lib/rally-model";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

import { buttonStyle } from "@/components/button";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const rally = await fetchPublicRally((await params).id);
  return { title: rally ? pickText(i18n.locale, rally.nameJa, rally.nameEn)?.text : undefined };
}

// One rally on its own page: its photo, how far along the visitor is, the stamps still to unlock, the places in order,
// and the three things to do (bookmark it, head for the next place on the map, stamp the place they are standing at).
export default async function RallyPage({ params, searchParams }: Props) {
  const i18n = await initLingui();
  const { id } = await params;
  const [viewer, detail, rallies, mine] = await Promise.all([getViewer(searchParams), fetchPublicRally(id), listRallies(), getMyStamps()]);
  const rally = rallies.find((r) => r.id === id);
  if (!detail || !rally) notFound();

  const name = pickText(i18n.locale, rally.nameJa, rally.nameEn)?.text ?? rally.nameJa;
  const stamped = rally.stamped ?? 0;
  const done = rally.total > 0 && stamped === rally.total;
  const held = [...mine.ids];
  const finishedAt = mine.completed.get(id) ?? null;
  const heldSet = new Set(held);
  // Where "start now" leads: the next place not yet stamped (the first one when nothing is), opened on the map.
  const next = nextSlot(rally);
  const start = detail.places.find((p) => (next && detail.kind === "course" ? p.routeId === next.id : true) && !heldSet.has(p.id)) ?? detail.places.find((p) => !heldSet.has(p.id));
  const startHref = start ? `/map?route=${encodeURIComponent(start.routeId)}&stop=${encodeURIComponent(start.id)}` : "/map";
  const canStampHere = !done && detail.places.some((p) => p.lat !== null && p.status !== "closed" && !heldSet.has(p.id));
  const button = buttonStyle("primary", "lg", "flex w-full");
  const quietButton = buttonStyle("secondary", "lg", "flex w-full");
  // One main button at a time: the way to the first place until something is stamped, then the stamp button for the place you are at.

  return (
    <div className="flex flex-col gap-6 pt-2 lg:pt-0">
      <div className="px-4">
        <BackLink href="/rallies">
          <Trans>ラリー</Trans>
        </BackLink>
      </div>

      <div className="flex flex-col gap-4 px-4">
        <h1 className="text-3xl font-bold leading-snug lg:text-4xl">{name}</h1>
        {isSoon(rally) ? (
          <p className="inline-block w-fit rounded-lg border-2 border-dashed border-line px-3 text-xl font-bold text-muted">
            <Trans>準備中</Trans>
          </p>
        ) : null}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl bg-surface md:max-w-2xl">
          <RoutePhoto src={detail.photoUrl} alt={name} />
        </div>
        <CreditCaption credit={detail.photoCredit} />
      </div>

      {done ? (
        // A finished rally: the closed medal, in place of the count and the bar.
        <section className="frame pattern-shippo mx-4 flex flex-col items-center gap-3 p-6 text-center">
          <Medal number={rally.total} done stamped={rally.total} total={rally.total} className="h-44 w-auto" />
          <p className="font-serif text-3xl font-bold text-accent">
            <Trans>コンプリート！</Trans>
          </p>
          <p className="text-xl font-bold">
            <Trans>{rally.total}か所、すべてそろいました。</Trans>
          </p>
          {finishedAt ? (
            <p className="text-lg text-muted">
              <Trans>達成日</Trans> <time dateTime={finishedAt}>{new Intl.DateTimeFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date(finishedAt))}</time>
            </p>
          ) : null}
          {viewer.signedIn ? <CertificateButton title={name} total={rally.total} locale={i18n.locale} /> : null}
        </section>
      ) : (
        <section className="frame mx-4 flex flex-col gap-3 p-4">
          <p className="text-6xl font-bold leading-none tabular-nums text-accent">
            {stamped}
            <span className="ml-2 text-3xl text-muted">/ {rally.total}</span>
          </p>
          <Bar stamped={stamped} total={rally.total} label={i18n._(msg`スタンプの進み具合`)} />
          <p className="text-xl font-bold">{stamped === 0 ? <Trans>まだスタンプはありません。</Trans> : <Trans>あと{rally.total - stamped}か所</Trans>}</p>
          <LastUpdated iso={detail.updatedAt} locale={i18n.locale} />
        </section>
      )}

      {!isSoon(rally) ? (
        <section className="mx-4 flex flex-col gap-3">
          <Link href={startHref} className={stamped === 0 ? button : quietButton}>
            {stamped === 0 ? <Trans>いますぐはじめる</Trans> : <Trans>つづきをはじめる</Trans>}
          </Link>
          {canStampHere ? <RallyNearbyStamp places={detail.places} held={held} locale={i18n.locale} rallyName={name} quiet={stamped === 0} /> : null}
          <RallyBookmark rallyId={rally.id} />
        </section>
      ) : null}

      {rally.total > 0 ? (
        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>
            <Trans>スタンプ</Trans>
          </SectionBanner>
          <div className="-mx-4">
            <StampLegend />
          </div>
          <StampGrid total={rally.total} stamped={stampedNumbers(rally)} showNext={rally.stamped !== null} />
        </section>
      ) : null}

      {rally.total > 0 ? (
        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>
            <Trans>めぐる場所</Trans>
          </SectionBanner>
          <div className="rounded-3xl bg-surface">
            <SlotList rally={rally} locale={i18n.locale} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
