import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { NearbyPlaces, type Nearby } from "@/components/NearbyPlaces";
import { PlaceFacts } from "@/components/PlaceFacts";
import { PlaceIcon } from "@/components/PlaceIcon";
import { SectionBanner } from "@/components/SectionBanner";
import { Localized } from "@/components/Localized";
import { CreditCaption } from "@/components/PhotoCredit";
import { RichBody } from "@/components/RichBody";
import { RoutePhoto } from "@/components/RoutePhoto";
import { initLingui } from "@/i18n/server";
import { listPlaces, listRoutes } from "@/lib/content";
import { formatDay } from "@/lib/format";
import { distanceMeters } from "@/lib/places";
import { pickText } from "@/lib/pick-text";
import { getPost } from "@/lib/posts";

type Props = { params: Promise<{ id: string }> };

/** The places shown under a post: those within this far of its place (straight line), at most this many. */
const NEARBY_METERS = 1000;
const NEARBY_MAX = 5;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const post = await getPost((await params).id);
  return { title: post ? pickText(i18n.locale, post.titleJa, post.titleEn)?.text : undefined };
}

// One blog post. A draft, or a post dated ahead, is not sent by the API, so it reads as "not found" here.
export default async function BlogPostPage({ params }: Props) {
  const i18n = await initLingui();
  const post = await getPost((await params).id);
  if (!post) notFound();

  const title = pickText(i18n.locale, post.titleJa, post.titleEn);
  const body = pickText(i18n.locale, post.bodyJa, post.bodyEn);
  const author = pickText(i18n.locale, post.authorNameJa, post.authorNameEn);

  // The place the post is about (published and checked ones only, as everywhere), and what is around it.
  const places = post.placeId ? await listPlaces() : [];
  const place = places.find((p) => p.id === post.placeId) ?? null;
  const placeName = place ? pickText(i18n.locale, place.nameJa, place.nameEn) : null;
  const nearby: Nearby[] = place
    ? places
        .filter((p) => p.id !== place.id)
        .map((p) => ({ p, meters: distanceMeters(place.position, p.position) }))
        .filter(({ meters }) => meters <= NEARBY_METERS)
        .sort((a, b) => a.meters - b.meters)
        .slice(0, NEARBY_MAX)
        .map(({ p, meters }) => {
          const name = pickText(i18n.locale, p.nameJa, p.nameEn);
          return { id: p.id, name: name?.text ?? p.nameJa, nameLang: name?.lang ?? "ja", category: p.category, meters };
        })
    : [];
  const hours = place ? pickText(i18n.locale, place.hoursJa ?? "", place.hoursEn) : null;
  const closed = place ? pickText(i18n.locale, place.closedDaysJa ?? "", place.closedDaysEn) : null;
  const routeId = place?.routes[0] ? (await listRoutes()).find((r) => r.order === place.routes[0])?.id : undefined;
  const mapHref = place ? `/map?${routeId ? `route=${encodeURIComponent(routeId)}&` : ""}place=${encodeURIComponent(place.id)}` : null;

  return (
    <article className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/blog">
          <Trans>ブログ</Trans>
        </BackLink>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            <Localized value={title} />
          </h1>
          <time dateTime={post.publishedOn} className="text-lg text-muted">
            {formatDay(i18n.locale, post.publishedOn)}
          </time>
          {place ? (
            <a href="#place" className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-4 text-lg font-bold">
              <PlaceIcon category={place.category} size={24} />
              <Localized value={placeName} />
            </a>
          ) : null}
        </div>
      </div>

      {post.coverPhotoUrl ? (
        <figure className="flex flex-col gap-2">
          <span className="relative block aspect-[4/3] overflow-hidden sm:rounded-xl">
            <RoutePhoto src={post.coverPhotoUrl} alt={title?.text ?? ""} />
          </span>
          <CreditCaption credit={post.coverCredit} className="px-4" />
        </figure>
      ) : null}

      {body ? (
        <div className="px-4">
          <RichBody text={body.text} lang={body.lang} anchor={post.id} />
        </div>
      ) : null}

      {place ? (
        <section id="place" className="flex scroll-mt-4 flex-col gap-3 px-4">
          <SectionBanner>
            <Trans>詳しい情報</Trans>
          </SectionBanner>
          <PlaceFacts
            place={{
              category: place.category,
              name: placeName?.text ?? place.nameJa,
              address: place.address ?? null,
              phone: place.phone ?? null,
              hours: hours?.text ?? null,
              closedDays: closed?.text ?? null,
              website: place.website ?? null,
              status: place.status,
              checked: place.lastVerified ? formatDay(i18n.locale, place.lastVerified) : null,
            }}
          />
          {mapHref ? (
            <Link href={mapHref} className="tap-target flex min-h-14 items-center justify-center rounded-xl border border-ink bg-surface px-6 text-xl font-bold text-accent hover:bg-paper">
              <Trans>地図で見る</Trans>
            </Link>
          ) : null}
        </section>
      ) : null}

      {nearby.length > 0 ? (
        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>
            <Trans>まわりの場所</Trans>
          </SectionBanner>
          <NearbyPlaces places={nearby} />
        </section>
      ) : null}

      {author ? (
        <footer className="mx-4 flex items-center gap-3 rounded-xl bg-surface p-4">
          {post.authorPhotoUrl ? (
            <Image
              src={post.authorPhotoUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-full object-cover"
              unoptimized
            />
          ) : null}
          <p className="min-w-0 text-lg">
            <span className="text-base text-muted">
              <Trans>書いた人</Trans>
            </span>
            <br />
            <span className="font-bold">
              <Localized value={author} />
            </span>
          </p>
        </footer>
      ) : null}
    </article>
  );
}
