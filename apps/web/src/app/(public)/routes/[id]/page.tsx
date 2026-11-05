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
import { getRoute, listPlacesForRoute, pickText, toMapPlace } from "@/lib/content";
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
  // The places are looked up by the route's number, so they wait for the route.
  const places = (await listPlacesForRoute(route.order)).map((p) => toMapPlace(i18n.locale, p));
  const notices = allNotices.filter((n) => n.routeId === null || n.routeId === route.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4">
        <BackLink href="/routes">
          <Trans>ルート一覧</Trans>
        </BackLink>
      </div>
      <RouteView
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
        jumpLabel={i18n._(msg`このページの項目`)}
        bookmarkable
        notices={
          notices.length > 0 ? (
            <>
              <TrailNotices notices={notices} locale={i18n.locale} />
              <a href={`/notices/feed.xml?route=${encodeURIComponent(route.id)}${i18n.locale === "en" ? "&lang=en" : ""}`} className="px-4 text-base text-accent underline @4xl:px-0">
                <Trans>このルートのお知らせをフィードで受け取る</Trans>
              </a>
            </>
          ) : null
        }
      />
      {/* Share: handy, but not what a visitor opens the page for, so it comes last (the bookmark is in the jump bar). */}
      <ShareRoute route={{ nameJa: route.nameJa }} />
    </div>
  );
}
