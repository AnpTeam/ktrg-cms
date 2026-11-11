import Link from "next/link";
import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
// Types only from the content module: the admin's live page preview (a client component) draws this, and the content
// module would bring the sample data into its bundle (client-boundary.test.ts).
import type { Prefecture, RouteSummary } from "@/lib/content";
import { pickText } from "@/lib/pick-text";
import { municipalityName } from "@/lib/municipalities";
import { buildStops, type NodeState, type Stop } from "@/lib/ribbon";
import { Localized } from "./Localized";
import { PrefectureIcon } from "./PrefectureIcon";
import { PlaceLine } from "./PlaceLine";
import { PrefectureName } from "./PrefectureName";
import { RoutePhoto } from "./RoutePhoto";
import { RouteStats } from "./RouteStats";

// The 19 routes as one continuous trail (WBS 3.2.3). The order is the order of the walk. Each route is a row: its
// number, name, place and numbers on one line, with a small photo at the side, rows divided by thin rules (no boxes, no
// progress line). One column until 1280 px, then two.

/**
 * One course as a calm row (docs/design-language.md, the home and /routes lists): the number large in Mincho, the name,
 * the place, the numbers in words, and how far along in words; a small photo at the side. No badges over a photo.
 */
function RouteRow({ route, state, locale }: { route: RouteSummary; state: NodeState; locale: string }) {
  const { t } = useLingui();
  const { spotCount, stampedCount } = route;
  const name = pickText(locale, route.nameJa, route.nameEn);
  const place = municipalityName(locale, route.municipality);
  const soon = state === "soon";

  return (
    <span className="flex items-start gap-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-3">
          <span className={`font-serif text-3xl font-bold leading-none tabular-nums ${soon ? "text-muted" : "text-accent"}`}>{route.order}</span>
          <span className="min-w-0 text-xl font-bold leading-snug">
            <Localized value={name} />
          </span>
        </span>
        {route.prefecture || place ? (
          <span className="mt-1 block text-lg leading-snug text-muted">
            <PlaceLine prefecture={route.prefecture} place={place} locale={locale} />
          </span>
        ) : null}
        {soon ? (
          <span className="mt-1 block text-lg font-bold text-muted">
            <Trans>準備中</Trans>
          </span>
        ) : (
          <span className="mt-2 block">
            <RouteStats route={route} line />
            {spotCount > 0 ? (
              <span className="mt-1 block text-lg font-bold tabular-nums">
                {stampedCount === null ? t`スタンプ場所 ${spotCount}か所` : t`スタンプ ${stampedCount} / ${spotCount}`}
              </span>
            ) : null}
          </span>
        )}
      </span>
      {/* A course that is not ready shows its photo soft and grey, so it reads as unfinished at a glance. */}
      <span className="relative mt-1 block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
        <span className={`absolute inset-0 block ${soon ? "scale-110 blur-[3px] saturate-50" : ""}`}>
          <RoutePhoto src={route.photoUrl} alt="" />
        </span>
      </span>
    </span>
  );
}

function StopRow({ stop, href, locale }: { stop: Stop; href: string; locale: string }) {
  const { route, state } = stop;
  const row = <RouteRow route={route} state={state} locale={locale} />;

  return (
    <li className="border-b border-line px-4 xl:px-1">
      {state === "soon" ? (
        <div>{row}</div>
      ) : (
        <Link href={href} className="tap-target block hover:bg-surface focus-visible:outline-offset-4">
          {row}
        </Link>
      )}
    </li>
  );
}

function GroupHeading({ prefecture }: { prefecture: Prefecture }) {
  return (
    <li className="xl:col-span-full" role="presentation">
      <h2 className="flex items-center gap-2 px-4 pb-2 pt-6 text-lg font-bold text-muted xl:px-1">
        <PrefectureIcon value={prefecture} />
        <PrefectureName value={prefecture} />
      </h2>
    </li>
  );
}

export function TrailRibbon({ routes, hrefFor, locale }: { routes: RouteSummary[]; hrefFor: (route: RouteSummary) => string; locale: string }) {
  const stops = buildStops(routes);
  // Sections by prefecture only when every route has one; otherwise one plain trail.
  const grouped = routes.length > 0 && routes.every((r) => r.prefecture !== null);

  return (
    // One column; from 1280 px the rows sit in two columns (a row needs about 420 px for its name, numbers and photo).
    <ol className="border-t border-line xl:grid xl:grid-cols-2 xl:gap-x-8 xl:px-4">
      {stops.map((stop, i) => {
        const prev = stops[i - 1]?.route.prefecture;
        const heading =
          grouped && stop.route.prefecture && stop.route.prefecture !== prev ? (
            <GroupHeading key={`h-${stop.route.id}`} prefecture={stop.route.prefecture} />
          ) : null;
        return (
          <FragmentWith key={stop.route.id} heading={heading}>
            <StopRow stop={stop} href={hrefFor(stop.route)} locale={locale} />
          </FragmentWith>
        );
      })}
    </ol>
  );
}

function FragmentWith({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <>
      {heading}
      {children}
    </>
  );
}
