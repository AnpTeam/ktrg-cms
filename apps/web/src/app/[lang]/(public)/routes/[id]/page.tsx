import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Localized } from "@/components/Localized";
import { Notice } from "@/components/Notice";
import { PrefectureName } from "@/components/PrefectureName";
import { RouteSilhouette } from "@/components/RouteSketch";
import { RouteStats } from "@/components/RouteStats";
import { RowLink } from "@/components/RowLink";
import { StatusWord } from "@/components/StatusBanner";
import { forViewer, getRoute, pickText } from "@/lib/content";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const route = await getRoute((await params).id);
  return { title: route ? pickText(i18n.locale, route.nameJa, route.nameEn)?.text : undefined };
}

// Minimal route page: the header, the stats and the spot list, so that every spot
// is reachable. History, video, elevation profile and notices are WBS 3.2.4.
export default async function RouteDetailPage({ params, searchParams }: Props) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const found = await getRoute((await params).id);
  if (!found) notFound();
  const route = forViewer(found, viewer);
  const to = (path: string) => localePath(i18n.locale, path);
  const description = pickText(i18n.locale, route.descriptionJa, route.descriptionEn);

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4">
        <BackLink href={to("/routes")}>
          <Trans>ルート一覧</Trans>
        </BackLink>
      </div>

      <header className="px-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-3xl font-bold">
            <Localized value={pickText(i18n.locale, route.nameJa, route.nameEn)} />
          </h1>
          {route.sketch ? <RouteSilhouette sketch={route.sketch} size={96} /> : null}
        </div>
        {route.prefecture || route.municipality ? (
          <p className="mt-2 text-lg text-muted">
            {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
            {route.prefecture && route.municipality ? " " : null}
            {route.municipality}
          </p>
        ) : null}
        <RouteStats route={route} />
        {description ? (
          <p className="mt-4 max-w-prose whitespace-pre-line text-lg leading-8">
            <Localized value={description} tag={false} />
          </p>
        ) : null}
      </header>

      {route.spots.length > 0 ? (
        <section>
          <h2 className="px-4 pb-3 text-xl font-bold">
            <Trans>スタンプの場所</Trans>
          </h2>
          <ul>
            {route.spots.map((spot) => (
              <li key={spot.id}>
                <RowLink
                  href={to(`/spots/${spot.id}`)}
                  title={<Localized value={pickText(i18n.locale, spot.nameJa, spot.nameEn)} />}
                  detail={
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <StatusWord status={spot.status} />
                      {spot.stamped === true ? (
                        <span className="font-bold text-ink">
                          <Trans>押した</Trans>
                        </span>
                      ) : null}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}
