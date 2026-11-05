import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Localized } from "@/components/Localized";
import { NearbyPlaces, type Nearby } from "@/components/NearbyPlaces";
import { CreditCaption } from "@/components/PhotoCredit";
import { PlaceFacts } from "@/components/PlaceFacts";
import { PlaceIcon } from "@/components/PlaceIcon";
import { RichBody } from "@/components/RichBody";
import { RoutePhoto } from "@/components/RoutePhoto";
import { SectionBanner } from "@/components/SectionBanner";
import { Avatar } from "@/components/blog/Avatar";
import { CommentSection } from "@/components/blog/CommentSection";
import { RouteCard, SpotCard } from "@/components/blog/LinkedCards";
import { PostCard } from "@/components/blog/PostCard";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { initLingui } from "@/i18n/server";
import { getSpot, listPlaces, listRoutes } from "@/lib/content";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import { distanceMeters } from "@/lib/places";
import { getPost, listComments, listPosts, neighbours } from "@/lib/posts";
import { getViewer } from "@/lib/viewer";
import { ChevronIcon, ChevronLeftIcon } from "@/components/icons";

type Props = { params: Promise<{ id: string }> };

/** The places shown under a post: those within this far of its place (straight line), at most this many. */
const NEARBY_METERS = 1000;
const NEARBY_MAX = 5;
/** How many other posts the side column and the end of a post suggest. */
const MORE_POSTS = 3;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const post = await getPost((await params).id);
  return { title: post ? pickText(i18n.locale, post.titleJa, post.titleEn)?.text : undefined };
}

// One blog post, laid out like a magazine article: headline, who and when, a big photo, the text beside a column of
// what to read next, then what the post is about (a route, a waypoint, a place with its details and what is around it),
// sharing, the next and the earlier post, and the comments. A draft, or a post dated ahead, is not sent by the API,
// so it reads as "not found" here.
export default async function BlogPostPage({ params }: Props) {
  const i18n = await initLingui();
  const id = (await params).id;
  const post = await getPost(id);
  if (!post) notFound();
  const locale = i18n.locale;

  const [viewer, posts, comments, routes, places, spot] = await Promise.all([
    getViewer(),
    listPosts(),
    listComments(post.id),
    post.routeId || post.placeId ? listRoutes() : Promise.resolve([]),
    post.placeId ? listPlaces() : Promise.resolve([]),
    post.spotId ? getSpot(post.spotId) : Promise.resolve(undefined),
  ]);

  const title = pickText(locale, post.titleJa, post.titleEn);
  const body = pickText(locale, post.bodyJa, post.bodyEn);
  const author = pickText(locale, post.authorNameJa, post.authorNameEn);
  const { newer, older } = neighbours(posts, post.id);
  const others = posts.filter((p) => p.id !== post.id).slice(0, MORE_POSTS);

  const route = post.routeId ? (routes.find((r) => r.id === post.routeId) ?? null) : null;
  // The place the post is about (published and checked ones only, as everywhere), and what is around it.
  const place = places.find((p) => p.id === post.placeId) ?? null;
  const placeName = place ? pickText(locale, place.nameJa, place.nameEn) : null;
  const nearby: Nearby[] = place
    ? places
        .filter((p) => p.id !== place.id)
        .map((p) => ({ p, meters: distanceMeters(place.position, p.position) }))
        .filter(({ meters }) => meters <= NEARBY_METERS)
        .sort((a, b) => a.meters - b.meters)
        .slice(0, NEARBY_MAX)
        .map(({ p, meters }) => {
          const name = pickText(locale, p.nameJa, p.nameEn);
          return { id: p.id, name: name?.text ?? p.nameJa, nameLang: name?.lang ?? "ja", category: p.category, meters };
        })
    : [];
  const hours = place ? pickText(locale, place.hoursJa ?? "", place.hoursEn) : null;
  const closed = place ? pickText(locale, place.closedDaysJa ?? "", place.closedDaysEn) : null;
  const placeRouteId = place?.routes[0] ? routes.find((r) => r.order === place.routes[0])?.id : undefined;
  const mapHref = place ? `/map?${placeRouteId ? `route=${encodeURIComponent(placeRouteId)}&` : ""}place=${encodeURIComponent(place.id)}` : null;
  const hasAbout = !!(route || spot || place);

  const chip = "inline-flex w-fit items-center gap-2 rounded-full bg-surface py-1 pl-3 pr-4 text-base font-bold hover:bg-paper";

  return (
    <article className="flex flex-col gap-8 pt-2">
      <header className="flex flex-col gap-4 px-4 lg:px-0">
        <BackLink href="/blog">
          <Trans>ブログ</Trans>
        </BackLink>
        {route || spot || place ? (
          <p className="flex flex-wrap gap-2">
            {route ? (
              <Link href={`/routes/${route.id}`} className={chip}>
                <Trans>ルート</Trans> <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
              </Link>
            ) : null}
            {spot ? (
              <Link href={`/spots/${spot.id}`} className={chip}>
                <Localized value={pickText(locale, spot.nameJa, spot.nameEn)} />
              </Link>
            ) : null}
            {place ? (
              <a href="#place" className={chip}>
                <PlaceIcon category={place.category} size={20} />
                <Localized value={placeName} />
              </a>
            ) : null}
          </p>
        ) : null}
        <h1 className="max-w-4xl text-3xl font-bold leading-snug md:text-4xl">
          <Localized value={title} />
        </h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-lg text-muted">
          {author ? (
            <span className="flex items-center gap-2">
              <Avatar src={post.authorPhotoUrl} name={author.text} size={36} />
              <span className="font-bold text-ink">
                <Localized value={author} />
              </span>
            </span>
          ) : null}
          <time dateTime={post.publishedOn}>{formatDay(locale, post.publishedOn)}</time>
        </p>
      </header>

      {post.coverPhotoUrl ? (
        <figure className="flex flex-col gap-2">
          <span className="relative block aspect-[16/10] overflow-hidden md:aspect-[16/8] lg:rounded-3xl">
            <RoutePhoto src={post.coverPhotoUrl} alt={title?.text ?? ""} />
          </span>
          <CreditCaption credit={post.coverCredit} className="px-4 lg:px-0" />
        </figure>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-10">
          {body ? (
            <div className="px-4 lg:px-0">
              <RichBody text={body.text} lang={body.lang} anchor={post.id} />
            </div>
          ) : null}

          {hasAbout ? (
            <section className="flex flex-col gap-4 px-4 lg:px-0">
              <SectionBanner>
                <Trans>この記事の場所</Trans>
              </SectionBanner>
              {route ? <RouteCard route={route} locale={locale} /> : null}
              {spot ? <SpotCard spot={spot} locale={locale} /> : null}
              {place ? (
                <div id="place" className="flex scroll-mt-4 flex-col gap-3">
                  <PlaceFacts
                    place={{
                      category: place.category,
                      name: placeName?.text ?? place.nameJa,
                      address: pickText(locale, place.addressJa ?? "", place.addressEn ?? null)?.text || null,
                      phone: place.phone ?? null,
                      hours: hours?.text ?? null,
                      closedDays: closed?.text ?? null,
                      website: place.website ?? null,
                      status: place.status,
                      checked: place.lastVerified ? formatDay(locale, place.lastVerified) : null,
                    }}
                  />
                  {mapHref ? (
                    <Link href={mapHref} className="tap-target flex min-h-14 items-center justify-center rounded-xl border border-ink bg-surface px-6 text-xl font-bold text-accent hover:bg-paper">
                      <Trans>地図で見る</Trans>
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {nearby.length > 0 ? (
            <section className="flex flex-col gap-3 px-4 lg:px-0">
              <SectionBanner>
                <Trans>まわりの場所</Trans>
              </SectionBanner>
              <NearbyPlaces places={nearby} />
            </section>
          ) : null}

          <section className="flex flex-col gap-3 border-y border-line/40 px-4 py-5 lg:px-0">
            <p className="text-lg font-bold">
              <Trans>この記事を共有する</Trans>
            </p>
            <ShareButtons title={title?.text ?? ""} />
          </section>

          {newer || older ? (
            <nav aria-label={i18n._(msg`前後の記事`)} className="grid gap-3 px-4 sm:grid-cols-2 lg:px-0">
              {older ? (
                <Link href={`/blog/${older.id}`} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 hover:bg-paper">
                  <span className="inline-flex items-center gap-1 text-base text-muted">
                    <ChevronLeftIcon size={20} />
                    <Trans>前の記事</Trans>
                  </span>
                  <span className="text-lg font-bold leading-snug text-accent">
                    <Localized value={pickText(locale, older.titleJa, older.titleEn)} />
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {newer ? (
                <Link href={`/blog/${newer.id}`} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 text-right hover:bg-paper">
                  <span className="inline-flex items-center justify-end gap-1 text-base text-muted">
                    <Trans>次の記事</Trans>
                    <ChevronIcon size={20} />
                  </span>
                  <span className="text-lg font-bold leading-snug text-accent">
                    <Localized value={pickText(locale, newer.titleJa, newer.titleEn)} />
                  </span>
                </Link>
              ) : null}
            </nav>
          ) : null}

          <div className="px-4 lg:px-0">
            <CommentSection postId={post.id} comments={comments} signedIn={viewer.signedIn} locale={locale} loginHref={`/login?next=${encodeURIComponent(`/blog/${post.id}`)}`} />
          </div>
        </div>

        {others.length > 0 ? (
          <aside className="flex flex-col gap-4 px-4 lg:sticky lg:top-6 lg:px-0">
            <h2 className="border-l-[6px] border-accent pl-3 text-2xl font-bold">
              <Trans>ほかの記事</Trans>
            </h2>
            <ul className="flex flex-col gap-4">
              {others.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} locale={locale} />
                </li>
              ))}
            </ul>
            <Link href="/blog" className="tap-target flex items-center justify-center rounded-xl border-2 border-ink px-5 text-lg font-bold hover:bg-surface">
              <Trans>ブログをすべて見る</Trans>
            </Link>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
