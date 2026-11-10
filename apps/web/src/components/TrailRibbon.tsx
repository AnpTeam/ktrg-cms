import Link from "next/link";
import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
// Types only from the content module: the admin's live page preview (a client component) draws this, and the content
// module would bring the sample data into its bundle (client-boundary.test.ts).
import type { Prefecture, RouteSummary } from "@/lib/content";
import { pickText } from "@/lib/pick-text";
import { municipalityName } from "@/lib/municipalities";
import { connectorStates, nodeState, type NodeState } from "@/lib/ribbon";
import { Localized } from "./Localized";
import { PrefectureIcon } from "./PrefectureIcon";
import { PlaceLine } from "./PlaceLine";
import { PrefectureName } from "./PrefectureName";
import { RoutePhoto } from "./RoutePhoto";
import { RouteStats } from "./RouteStats";

// The 19 routes as one continuous trail (WBS 3.2.3). The order is the order of the walk. Each route is a row: its
// number, name, place and numbers in words, with a small photo at the side; the progress line runs down the left edge.
// `single` keeps one column at every width (the home page's chapter); /routes goes to two columns from 1280 px.

type Kind = "done" | "open" | "soon";

const LINE_X = "1.25rem"; // the line's middle, from the left edge

const segmentClass: Record<Kind, string> = {
  done: "border-solid border-moss",
  open: "border-solid border-line",
  soon: "border-dashed border-line",
};

function Segment({ kind, from, to, hide = "xl:hidden" }: { kind: Kind; from: string; to: string; hide?: string }) {
  return (
    <span aria-hidden="true" className={`absolute -translate-x-1/2 border-l-4 ${hide} ${segmentClass[kind]}`} style={{ left: LINE_X, top: from, bottom: to }} />
  );
}

interface Stop {
  route: RouteSummary;
  state: NodeState;
  above: Kind | null;
  below: Kind | null;
}

export function buildStops(routes: RouteSummary[]): Stop[] {
  const states = routes.map((route) => nodeState({ status: route.status, stamped: route.stampedCount, total: route.spotCount }));
  const connectors = connectorStates(states);
  // A jump in the numbers (the home page lists only open courses: 1, then 16) is dashed like a course not ready yet,
  // so the line never claims two courses meet when others lie between them.
  const gap = (i: number) => (routes[i]?.order ?? 0) - (routes[i - 1]?.order ?? 0) > 1;
  const into = (i: number): Kind | null => (i === 0 ? null : states[i] === "soon" || gap(i) ? "soon" : connectors[i] === "done" ? "done" : "open");
  return routes.map((route, i) => ({
    route,
    state: states[i] as NodeState,
    above: into(i),
    below: i === routes.length - 1 ? null : into(i + 1),
  }));
}

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
            <RouteStats route={route} compact />
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

function StopRow({ stop, href, locale, single }: { stop: Stop; href: string; locale: string; single: boolean }) {
  const { route, state } = stop;
  const row = <RouteRow route={route} state={state} locale={locale} />;
  // The line shows on a phone, and always in one column.
  const lineOnly = single ? "" : "xl:hidden";

  return (
    <li className={`relative pl-10 pr-4 ${single ? "" : "xl:p-0"}`}>
      {/* The progress line: down the left edge, with a mark by the course's number. */}
      {stop.above ? <Segment kind={stop.above} from="0" to="calc(100% - 1.75rem)" hide={lineOnly} /> : null}
      {stop.below ? <Segment kind={stop.below} from="1.75rem" to="0" hide={lineOnly} /> : null}
      <span
        aria-hidden="true"
        className={`absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-paper ${lineOnly} ${
          state === "complete" ? "border-shu bg-shu" : state === "inProgress" ? "border-moss" : state === "soon" ? "border-dashed border-line" : "border-line"
        }`}
        style={{ left: LINE_X, top: "1.75rem" }}
      />
      {state === "soon" ? (
        <div>{row}</div>
      ) : (
        <Link href={href} className="tap-target block rounded-lg hover:bg-surface focus-visible:outline-offset-4">
          {row}
        </Link>
      )}
    </li>
  );
}

function GroupHeading({ prefecture, next, first, single }: { prefecture: Prefecture; next: Kind | null; first: boolean; single: boolean }) {
  return (
    <li className="relative xl:col-span-full" role="presentation">
      {next ? <Segment kind={next} from={first ? "50%" : "0"} to="0" hide={single ? "" : "xl:hidden"} /> : null}
      <h2 className={`flex items-center gap-2 py-3 pl-10 pr-4 text-lg font-bold text-muted ${single ? "" : "xl:px-1 xl:pb-2 xl:pt-6"}`}>
        <PrefectureIcon value={prefecture} />
        <PrefectureName value={prefecture} />
      </h2>
    </li>
  );
}

export function TrailRibbon({ routes, hrefFor, locale, single = false }: { routes: RouteSummary[]; hrefFor: (route: RouteSummary) => string; locale: string; single?: boolean }) {
  const stops = buildStops(routes);
  // Sections by prefecture only when every route has one; otherwise one plain trail.
  const grouped = routes.length > 0 && routes.every((r) => r.prefecture !== null);

  return (
    // One column with the progress line down its left; from 1280 px the rows sit in two columns (a row needs about
    // 420 px for its name, numbers and photo) and the line gives way to the large numbers.
    <ol className={single ? "" : "xl:grid xl:grid-cols-2 xl:gap-x-8 xl:gap-y-2 xl:px-4"}>
      {stops.map((stop, i) => {
        const prev = stops[i - 1]?.route.prefecture;
        const heading =
          grouped && stop.route.prefecture && stop.route.prefecture !== prev ? (
            <GroupHeading key={`h-${stop.route.id}`} prefecture={stop.route.prefecture} next={stop.above ?? stop.below} first={i === 0} single={single} />
          ) : null;
        return (
          <FragmentWith key={stop.route.id} heading={heading}>
            <StopRow stop={stop} href={hrefFor(stop.route)} locale={locale} single={single} />
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
