import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { DirectoryView } from "@/components/places/DirectoryView";
import { initLingui } from "@/i18n/server";
import { listPlaces, listRoutes, pickText } from "@/lib/content";
import { directoryList, groupCounts, placeGroups, type PlaceGroup } from "@/lib/places";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`お店と施設`) };
}

type Props = { searchParams: Promise<{ group?: string; route?: string }> };

// The directory for visitors: shops, toilets, stations ... along the courses, by kind and by course. Filtering is done
// here from the address (?group=&route=), so the page works and can be shared without JavaScript.
// shortcut: every matching place on one page, fine for a few hundred; add paging before the directory reaches thousands.
export default async function PlacesPage({ searchParams }: Props) {
  const [i18n, params, places, routes] = await Promise.all([initLingui(), searchParams, listPlaces(), listRoutes()]);
  const group = placeGroups.find((g): g is PlaceGroup => g === params.group);
  const asked = Number(params.route);
  const route = Number.isInteger(asked) && routes.some((r) => r.order === asked) ? asked : undefined;
  const shown = directoryList(places, { group, route });
  // The tabs count within the chosen course, so a tab is never offered that would show nothing.
  const counts = groupCounts(directoryList(places, { route }));

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/">
          <Trans>ホーム</Trans>
        </BackLink>
        <div className="flex flex-col gap-2 border-b-2 border-ink pb-4">
          <h1 className="font-serif text-4xl font-bold">
            <Trans>お店と施設</Trans>
          </h1>
          <p className="max-w-prose text-lg leading-8 text-muted">
            <Trans>道の近くのトイレ、お店、駅やバス停などです。営業時間は変わることがあるので、出かける前に確かめてください。</Trans>
          </p>
        </div>
      </div>
      <DirectoryView
        rows={shown.map((p) => {
          const name = pickText(i18n.locale, p.nameJa, p.nameEn);
          return {
            id: p.id,
            name: name?.text ?? p.nameJa,
            nameLang: name?.lang ?? "ja",
            category: p.category,
            icon: p.icon ?? null,
            status: p.status,
            routes: p.routes,
            hours: pickText(i18n.locale, p.hoursJa, p.hoursEn)?.text ?? null,
          };
        })}
        counts={counts}
        group={group}
        route={route}
        routes={[...routes].sort((a, b) => a.order - b.order).map((r) => ({ order: r.order, name: pickText(i18n.locale, r.nameJa, r.nameEn)?.text ?? r.nameJa }))}
      />
    </div>
  );
}
