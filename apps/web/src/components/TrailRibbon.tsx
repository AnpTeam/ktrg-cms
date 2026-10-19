import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { canGroupByPrefecture, pickText, type Prefecture, type RouteSummary } from "@/lib/content";
import { municipalityName } from "@/lib/municipalities";
import { connectorStates, nodeState, progressShare, type NodeState } from "@/lib/ribbon";
import { ChevronIcon } from "./icons";
import { Localized } from "./Localized";
import { PrefectureIcon } from "./PrefectureIcon";
import { PrefectureName } from "./PrefectureName";
import { ElevationStrip, RouteSilhouette } from "./RouteSketch";
import { RouteStats } from "./RouteStats";
import { StampFace } from "./StampFace";
import { TrailNode } from "./TrailNode";

// The 19 routes as one continuous trail (WBS 3.2.3). The order is the order of the walk,
// so the list is drawn as a single line with one stop per route.

type Kind = "done" | "open" | "soon";

// The node is 44px tall and the row has 1rem of padding above it: its centre is 2.375rem down.
const NODE_CENTER = "2.375rem";
const COLUMN = "3.25rem"; // the node column; the line runs through its middle

const segmentClass: Record<Kind, string> = {
  done: "border-solid border-moss",
  open: "border-solid border-line",
  soon: "border-dashed border-line",
};

function Segment({ kind, from, to }: { kind: Kind; from: string; to: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -translate-x-1/2 border-l-4 ${segmentClass[kind]}`}
      style={{ left: `calc(${COLUMN} / 2)`, top: from, bottom: to }}
    />
  );
}

interface Stop {
  route: RouteSummary;
  state: NodeState;
  above: Kind | null;
  below: Kind | null;
}

function buildStops(routes: RouteSummary[]): Stop[] {
  const states = routes.map((route) =>
    nodeState({ status: route.status, stamped: route.stampedCount, total: route.spotCount }),
  );
  const connectors = connectorStates(states);
  const into = (i: number): Kind | null =>
    i === 0 ? null : states[i] === "soon" ? "soon" : connectors[i] === "done" ? "done" : "open";
  return routes.map((route, i) => ({
    route,
    state: states[i] as NodeState,
    above: into(i),
    below: i === routes.length - 1 ? null : into(i + 1),
  }));
}

function StopContent({ route, state, locale }: { route: RouteSummary; state: NodeState; locale: string }) {
  const { spotCount, stampedCount } = route;
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={`block text-xl font-bold leading-snug ${state === "soon" ? "text-muted" : ""}`}>
            <Localized value={pickText(locale, route.nameJa, route.nameEn)} />
          </span>
          {route.prefecture || route.municipality ? (
            <span className="mt-1 block text-lg text-muted">
              {route.prefecture ? <PrefectureName value={route.prefecture} /> : null}
              {route.prefecture && route.municipality ? " " : null}
              {municipalityName(locale, route.municipality)}
            </span>
          ) : null}
        </span>
        {route.sketch ? <RouteSilhouette sketch={route.sketch} /> : null}
      </span>

      {state === "soon" ? (
        <span className="mt-2 inline-block rounded-lg border-2 border-dashed border-line px-2 text-base font-bold text-muted">
          <Trans>準備中</Trans>
        </span>
      ) : (
        <>
          <RouteStats route={route} compact />
          {route.sketch?.elevations ? (
            <span className="mt-3 block">
              <ElevationStrip elevations={route.sketch.elevations} />
            </span>
          ) : null}
          {spotCount > 0 ? (
            <span className="mt-3 block text-lg font-bold">
              {stampedCount === null ? (
                <Trans>スタンプ場所 {spotCount}か所</Trans>
              ) : (
                <>
                  <span className="whitespace-nowrap">
                    <Trans>
                      スタンプ {stampedCount} / {spotCount}
                    </Trans>
                  </span>
                  {spotCount <= 12 ? (
                    <span aria-hidden="true" className="mt-1.5 flex flex-wrap gap-1">
                      {Array.from({ length: spotCount }, (_, i) => (
                        <StampFace key={i} state={i < stampedCount ? "stamped" : "empty"} className="h-3.5 w-3.5 rounded-full!" />
                      ))}
                    </span>
                  ) : null}
                </>
              )}
            </span>
          ) : null}
        </>
      )}
    </>
  );
}

function StopRow({ stop, href, locale }: { stop: Stop; href: string; locale: string }) {
  const { route, state } = stop;
  const grid = "grid items-start";
  const columns = { gridTemplateColumns: `${COLUMN} 1fr` };
  const node = (
    <span className="flex justify-center pt-4">
      <TrailNode state={state} order={route.order} share={progressShare(route.stampedCount, route.spotCount)} />
    </span>
  );
  const body = (
    <span className="block py-4 pr-2">
      <StopContent route={route} state={state} locale={locale} />
    </span>
  );

  return (
    <li className="relative">
      {stop.above ? <Segment kind={stop.above} from="0" to={`calc(100% - ${NODE_CENTER})`} /> : null}
      {stop.below ? <Segment kind={stop.below} from={NODE_CENTER} to="0" /> : null}
      {state === "soon" ? (
        <div className={`${grid} relative`} style={columns}>
          {node}
          {body}
        </div>
      ) : (
        <Link href={href} className={`${grid} tap-target group relative`} style={columns}>
          {node}
          <span className="flex items-start justify-between gap-3 rounded-xl group-hover:bg-surface">
            {body}
            <span className="shrink-0 self-center pr-1 text-muted">
              <ChevronIcon />
            </span>
          </span>
        </Link>
      )}
    </li>
  );
}

function GroupHeading({ prefecture, next, first }: { prefecture: Prefecture; next: Kind | null; first: boolean }) {
  return (
    <li className="relative" role="presentation">
      {next ? <Segment kind={next} from={first ? "50%" : "0"} to="0" /> : null}
      <h2 className="flex items-center gap-2 py-3 pl-[3.25rem] pr-4 text-lg font-bold text-muted">
        <PrefectureIcon value={prefecture} />
        <PrefectureName value={prefecture} />
      </h2>
    </li>
  );
}

export function TrailRibbon({
  routes,
  hrefFor,
  locale,
}: {
  routes: RouteSummary[];
  hrefFor: (route: RouteSummary) => string;
  locale: string;
}) {
  const stops = buildStops(routes);
  const grouped = canGroupByPrefecture(routes);

  return (
    <ol>
      {stops.map((stop, i) => {
        const prev = stops[i - 1]?.route.prefecture;
        const heading =
          grouped && stop.route.prefecture && stop.route.prefecture !== prev ? (
            <GroupHeading key={`h-${stop.route.id}`} prefecture={stop.route.prefecture} next={stop.above ?? stop.below} first={i === 0} />
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
