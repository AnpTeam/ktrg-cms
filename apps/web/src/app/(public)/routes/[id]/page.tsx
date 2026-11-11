import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { TrailNotices } from "@/components/landing/TrailNotices";
import { listNotices } from "@/lib/notices";
import { OfflinePack } from "@/components/OfflinePack";
import { ShareRoute } from "@/components/ShareRoute";
import { RouteView } from "@/components/RouteView";
import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { getRoute, listPlacesForRoute, listRoutes, pickText, toMapPlace } from "@/lib/content";
import { initLingui } from "@/i18n/server";
import { getMapSettings } from "@/lib/site-settings";
import { getMyStamps } from "@/lib/my-stamps";
import { getPrefs } from "@/lib/server-prefs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const route = await getRoute((await params).id);
  return { title: route ? pickText(i18n.locale, route.nameJa, route.nameEn)?.text : undefined };
}

// Route page (WBS 3.2.4, 3.2.8). The body is RouteView, shared with the admin's live preview.
export default async function RouteDetailPage({ params }: Props) {
  const i18n = await initLingui();
  // Each of these is a trip to the API and none needs another's answer: ask them all at once.
  // getMyStamps is cached per request (getRoute asks it too), so knowing whether the visitor has stamped anywhere costs nothing.
  const [found, prefs, settings, allNotices, mine] = await Promise.all([params.then((p) => getRoute(p.id)), getPrefs(), getMapSettings(), listNotices(), getMyStamps()]);
  if (!found) notFound();
  const route = found;
  // An old link or a bookmark can still land here; the name says which course, and there is nothing to read yet.
  if (route.status === "soon") {
    return (
      <div className="flex flex-col gap-4 px-4">
        <BackLink href="/routes">
          <Trans>ルート一覧</Trans>
        </BackLink>
        <h1 className="text-3xl font-bold">{pickText(i18n.locale, route.nameJa, route.nameEn)?.text}</h1>
        <p className="rounded-2xl bg-surface p-4 text-lg font-bold">
          <Trans>この区間は、準備中です。</Trans>
        </p>
      </div>
    );
  }
  // The places are looked up by the route's number, so they wait for the route; the course list gives the next course.
  const [placeRows, routes] = await Promise.all([listPlacesForRoute(route.order), listRoutes()]);
  const places = placeRows.map((p) => toMapPlace(i18n.locale, p));
  const next = routes.filter((r) => r.order > route.order).sort((a, b) => a.order - b.order)[0];
  const nextName = next ? pickText(i18n.locale, next.nameJa, next.nameEn) : null;
  const notices = allNotices.filter((n) => n.routeId === null || n.routeId === route.id);

  return (
    <div className="flex flex-col gap-6">
      <RouteView
        back={
          <BackLink href="/routes">
            <Trans>ルート一覧</Trans>
          </BackLink>
        }
        route={route}
        locale={i18n.locale}
        places={places}
        settings={settings}
        mergeStops={prefs.mergeStops}
        placesFirst={prefs.placesOnMap}
        labels={{ stamped: i18n._(msg`スタンプ済み`), closed: i18n._(msg`閉鎖中`), start: i18n._(msg`スタート`), goal: i18n._(msg`ゴール`) }}
        spotHref={(id) => `/spots/${id}`}
        offline={<OfflinePack routeId={route.id} area={route.area} settings={settings} />}
        showStampCount={mine.ids.size > 0}
        bookmarkable
        notices={
          notices.length > 0 ? (
            <>
              <TrailNotices notices={notices} locale={i18n.locale} />
              <a href={`/notices/feed.xml?route=${encodeURIComponent(route.id)}${i18n.locale === "en" ? "&lang=en" : ""}`} className="tap-target mx-4 inline-flex w-fit items-center text-base text-accent underline @4xl:mx-0">
                <Trans>このルートのお知らせをフィードで受け取る</Trans>
              </a>
            </>
          ) : null
        }
      />
      {/* The trail goes on: the next course, so a walker reading the whole page does not have to go back to the list. */}
      {next && nextName ? (
        <Link href={`/routes/${next.id}`} className="tap-target mx-4 flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 no-underline">
          <span className="min-w-0">
            <span className="block text-base text-muted">
              <Trans>つぎのルート</Trans>
            </span>
            <span lang={nextName.lang} className="block text-xl font-bold leading-snug">
              {next.order}. {nextName.text}
            </span>
          </span>
          <ChevronIcon />
        </Link>
      ) : null}
      {/* Share: handy, but not what a visitor opens the page for, so it comes last (the bookmark is in the jump bar). */}
      <ShareRoute route={{ nameJa: route.nameJa }} />
    </div>
  );
}
