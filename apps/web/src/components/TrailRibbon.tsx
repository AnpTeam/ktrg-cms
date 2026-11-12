import Link from "next/link";
import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
// Types only from the content module: the admin's live page preview (a client component) draws this, and the content
// module would bring the sample data into its bundle (client-boundary.test.ts).
import type { Prefecture, RouteSummary } from "@/lib/content";
import { pickText } from "@/lib/pick-text";
import { municipalityName } from "@/lib/municipalities";
import { buildStops, type NodeState, type Stop } from "@/lib/ribbon";
import { PinIcon, StampIcon } from "./icons";
import { NameRuby } from "@/components/Ruby";
import { PrefectureIcon } from "./PrefectureIcon";
import { PlaceLine } from "./PlaceLine";
import { PrefectureName } from "./PrefectureName";
import { RoutePhoto } from "./RoutePhoto";
import { RouteStats } from "./RouteStats";

// The 19 routes as one continuous trail (WBS 3.2.3). The order is the order of the walk. Each route is a row: its
// number, name, place and numbers, its photo fading in from the right, rows divided by thin rules (no boxes, no
// progress line). One column until 1280 px, then two.

/**
 * One course as a calm row (docs/design-language.md, the home and /routes lists): the number large in Mincho, the name,
 * the place, the numbers in words, and how far along in words; its photo fades in from the right. No badges over a photo.
 */
function RouteRow({ route, state, locale }: { route: RouteSummary; state: NodeState; locale: string }) {
  const { t } = useLingui();
  const { spotCount, stampedCount } = route;
  const name = pickText(locale, route.nameJa, route.nameEn);
  const place = municipalityName(locale, route.municipalities);
  const soon = state === "soon";

  return (
    <span className="relative flex h-full flex-col justify-center overflow-hidden">
      {/* The photo fades in from the right edge into the page (as the home capsules do, without the capsule); a course that
          is not ready shows it soft and grey, so it reads as unfinished at a glance. */}
      <span aria-hidden="true" className="absolute inset-y-0 right-0 block w-2/5 overflow-hidden @2xl:w-1/3">
        <span className={`absolute inset-0 block ${soon ? "scale-110 blur-[4px] saturate-50" : ""}`}>
          <RoutePhoto src={route.photoUrl} alt="" />
        </span>
        <span className="absolute inset-0 bg-linear-to-r from-paper from-10% to-transparent to-90%" />
      </span>
      <span className="relative block min-w-0 py-4 pl-4 pr-[36%] xl:pl-1">
        <span className="flex items-center gap-3">
          {/* The course's number on a round badge (as on the home list), grey while the course is not ready. */}
          <span className={`badge-pattern grid size-10 shrink-0 place-items-center rounded-full font-serif text-xl font-bold tabular-nums ${soon ? "bg-line/25 text-muted" : "bg-brand-strong text-on-brand-strong"}`}>{route.order}</span>
          {/* text-pretty: never a lone last character on a line of its own (辺, え, へ) */}
          <span className="min-w-0 text-pretty text-xl font-bold leading-snug group-hover:underline">
            <NameRuby title={name} reading={route.nameKana} />
          </span>
        </span>
        {route.prefecture || place ? (
          <span className="mt-2 flex items-start gap-1.5 text-lg leading-snug text-muted">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand [&_svg]:size-5">
              <PinIcon />
            </span>
            <span>
              <PlaceLine prefecture={route.prefecture} place={place} locale={locale} />
            </span>
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
              <span className="mt-1.5 flex items-center gap-1.5 text-lg font-bold tabular-nums">
                <span aria-hidden="true" className="shrink-0 text-brand [&_svg]:size-5">
                  <StampIcon />
                </span>
                {stampedCount === null ? t`スタンプ場所 ${spotCount}か所` : t`スタンプ ${stampedCount} / ${spotCount}`}
              </span>
            ) : null}
          </span>
        )}
      </span>
    </span>
  );
}

function StopRow({ stop, href, locale }: { stop: Stop; href: string; locale: string }) {
  const { route, state } = stop;
  const row = <RouteRow route={route} state={state} locale={locale} />;

  return (
    // A grid cell (two columns): the li is one stretched cell so a row beside a taller one still fills its height.
    <li className="grid border-b border-line">
      {state === "soon" ? (
        <div>{row}</div>
      ) : (
        <Link href={href} className="group tap-target block focus-visible:outline-offset-4">
          {row}
        </Link>
      )}
    </li>
  );
}

function GroupHeading({ prefecture }: { prefecture: Prefecture }) {
  return (
    <li className="xl:col-span-full" role="presentation">
      <h2 className="px-4 pb-3 pt-6 xl:px-1">
        {/* The crest in its white badge and the name, on a raised pill (the `lift` token: white on light, the panel tone on dark). */}
        <span className="inline-flex items-center gap-2 rounded-full bg-lift py-1 pl-1 pr-4 text-lg font-bold text-ink shadow-md ring-1 ring-line/20">
          <PrefectureIcon value={prefecture} />
          <PrefectureName value={prefecture} />
        </span>
      </h2>
    </li>
  );
}

export function TrailRibbon({ routes, hrefFor, locale, headings = true }: { routes: RouteSummary[]; hrefFor: (route: RouteSummary) => string; locale: string; /** Prefecture headings between the courses (off when one prefecture is already chosen: the tab says it). */ headings?: boolean }) {
  const stops = buildStops(routes);
  // Sections by prefecture only when every route has one; otherwise one plain trail.
  const grouped = headings && routes.length > 0 && routes.every((r) => r.prefecture !== null);

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
