import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { TrailNotices } from "@/components/landing/TrailNotices";
import { listNotices } from "@/lib/notices";
import { PrintShare } from "@/components/PrintShare";
import { RouteView } from "@/components/RouteView";
import { getRoute, listPlacesForRoute, pickText, toMapPlace } from "@/lib/content";
import { initLingui } from "@/i18n/server";
import { getMapSettings } from "@/lib/site-settings";
import { getViewer } from "@/lib/viewer";
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
  const found = await getRoute((await params).id);
  if (!found) notFound();
  const route = found;
  const prefs = await getPrefs();
  const settings = await getMapSettings();
  const places = (await listPlacesForRoute(route.order)).map((p) => toMapPlace(i18n.locale, p));

  const viewer = await getViewer();
  const notices = (await listNotices()).filter((n) => n.routeId === null || n.routeId === route.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4">
        <BackLink href="/routes">
          <Trans>ルート一覧</Trans>
        </BackLink>
      </div>
      <PrintShare route={{ id: route.id, nameJa: route.nameJa }} gpx={route.line ? { signedIn: viewer.signedIn } : undefined} />
      {/* The offline save (components/OfflineSave.tsx, public/sw.js) is built but left off until it is ready:
          <OfflineSave area={route.area} tileTemplate={gsiTileUrl(settings.base === "photo" ? "seamlessphoto" : settings.base)} /> */}
      <TrailNotices notices={notices} locale={i18n.locale} />
      {notices.length > 0 ? (
        <a href={`/notices/feed.xml?route=${encodeURIComponent(route.id)}${i18n.locale === "en" ? "&lang=en" : ""}`} className="-mt-3 px-4 text-sm text-accent underline">
          <Trans>このルートのお知らせをフィードで受け取る</Trans>
        </a>
      ) : null}
      <RouteView
        route={route}
        locale={i18n.locale}
        places={places}
        settings={settings}
        mergeStops={prefs.mergeStops}
        placesFirst={prefs.placesOnMap}
        labels={{ stamped: i18n._(msg`スタンプ済み`), closed: i18n._(msg`閉鎖中`), start: i18n._(msg`スタート`), goal: i18n._(msg`ゴール`) }}
        spotHref={(id) => `/spots/${id}`}
      />
    </div>
  );
}
