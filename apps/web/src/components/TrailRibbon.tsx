import Link from "next/link";
import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { canGroupByPrefecture, pickText, type Prefecture, type RouteSummary } from "@/lib/content";
import { municipalityName } from "@/lib/municipalities";
import { connectorStates, nodeState, progressShare, type NodeState } from "@/lib/ribbon";
import { Localized } from "./Localized";
import { MedalRow } from "./MedalRow";
import { PrefectureIcon } from "./PrefectureIcon";
import { PlaceLine } from "./PlaceLine";
import { PrefectureName } from "./PrefectureName";
import { RoutePhoto } from "./RoutePhoto";
import { RouteStats } from "./RouteStats";
import { TrailNode } from "./TrailNode";

// The 19 routes as one continuous trail (WBS 3.2.3). The order is the order of the walk. Each route is a card with
// its photo (and its name written over the photo), the numbers in one compact row, and a medal for each stamp place.
// The numbered badge sits on the photo's corner; the progress line runs down the left edge of the cards, clear of
// everything written on them.

type Kind = "done" | "open" | "soon";

const LINE_X = "1.25rem"; // the line's middle, from the left edge

const segmentClass: Record<Kind, string> = {
  done: "border-solid border-moss",
  open: "border-solid border-line",
  soon: "border-dashed border-line",
};

function Segment({ kind, from, to }: { kind: Kind; from: string; to: string }) {
  return (
    <span aria-hidden="true" className={`absolute -translate-x-1/2 border-l-4 md:hidden ${segmentClass[kind]}`} style={{ left: LINE_X, top: from, bottom: to }} />
  );
}

interface Stop {
  route: RouteSummary;
  state: NodeState;
  above: Kind | null;
  below: Kind | null;
}

function buildStops(routes: RouteSummary[]): Stop[] {
  const states = routes.map((route) => nodeState({ status: route.status, stamped: route.stampedCount, total: route.spotCount }));
  const connectors = connectorStates(states);
  const into = (i: number): Kind | null => (i === 0 ? null : states[i] === "soon" ? "soon" : connectors[i] === "done" ? "done" : "open");
  return routes.map((route, i) => ({
    route,
    state: states[i] as NodeState,
    above: into(i),
    below: i === routes.length - 1 ? null : into(i + 1),
  }));
}

/** The card: photo with the number, name and place over it; under it the numbers and the medals. */
function RouteCard({ route, state, locale }: { route: RouteSummary; state: NodeState; locale: string }) {
  const { t } = useLingui();
  const { spotCount, stampedCount } = route;
  const name = pickText(locale, route.nameJa, route.nameEn);
  const place = municipalityName(locale, route.municipality);
  const medalLabel = stampedCount === null ? t`スタンプ場所 ${spotCount}か所` : t`スタンプ ${stampedCount} / ${spotCount}`;

  return (
    <span className="block overflow-hidden rounded-3xl bg-surface">
      <span className="relative block aspect-[16/10] overflow-hidden">
        {/* A course that is not ready shows its photo blurred (the scale hides the soft edge), so it reads as unfinished at a glance. */}
        <span className={`absolute inset-0 block ${state === "soon" ? "scale-110 blur-[6px] saturate-50" : ""}`}>
          <RoutePhoto src={route.photoUrl} alt={name?.text ?? route.nameJa} />
        </span>
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5" />
        <span className="absolute left-2 top-2 block drop-shadow-md">
          <TrailNode state={state} order={route.order} share={progressShare(route.stampedCount, route.spotCount)} />
        </span>
        {state === "soon" ? (
          <span className="absolute right-3 top-3 rounded-lg border-2 border-dashed border-white/80 bg-black/55 px-2 text-base font-bold text-white">
            <Trans>準備中</Trans>
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 block px-3 pb-3 text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.75)]">
          <span className="block text-xl font-bold leading-snug text-white">
            <Localized value={name} />
          </span>
          {route.prefecture || place ? (
            <span className="mt-0.5 block text-lg leading-snug text-white/90">
              <PlaceLine prefecture={route.prefecture} place={place} locale={locale} />
            </span>
          ) : null}
        </span>
      </span>

      {state === "soon" ? null : (
        <span className="block px-3 pb-3 pt-2.5">
          <RouteStats route={route} compact />
          {spotCount > 0 ? (
            <span className="mt-2.5 block">
              <MedalRow total={spotCount} earned={stampedCount} label={medalLabel} />
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}

function StopRow({ stop, href, locale }: { stop: Stop; href: string; locale: string }) {
  const { route, state } = stop;
  const card = <RouteCard route={route} state={state} locale={locale} />;

  return (
    <li className="relative pb-4 pl-10 pr-4 md:p-0">
      {/* The progress line: down the left edge, with a small mark by the middle of the card. */}
      {stop.above ? <Segment kind={stop.above} from="0" to="50%" /> : null}
      {stop.below ? <Segment kind={stop.below} from="50%" to="0" /> : null}
      <span
        aria-hidden="true"
        className={`absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-paper md:hidden ${
          state === "complete" ? "border-shu bg-shu" : state === "inProgress" ? "border-moss" : state === "soon" ? "border-dashed border-line" : "border-line"
        }`}
        style={{ left: LINE_X, top: "calc(50% - 0.5rem)" }}
      />
      {state === "soon" ? (
        <div>{card}</div>
      ) : (
        <Link href={href} className="block rounded-3xl hover:opacity-95 focus-visible:outline-offset-4">
          {card}
        </Link>
      )}
    </li>
  );
}

function GroupHeading({ prefecture, next, first }: { prefecture: Prefecture; next: Kind | null; first: boolean }) {
  return (
    <li className="relative md:col-span-full" role="presentation">
      {next ? <Segment kind={next} from={first ? "50%" : "0"} to="0" /> : null}
      <h2 className="flex items-center gap-2 py-3 pl-10 pr-4 text-lg font-bold text-muted md:px-1 md:pb-2 md:pt-6">
        <PrefectureIcon value={prefecture} />
        <PrefectureName value={prefecture} />
      </h2>
    </li>
  );
}

export function TrailRibbon({ routes, hrefFor, locale }: { routes: RouteSummary[]; hrefFor: (route: RouteSummary) => string; locale: string }) {
  const stops = buildStops(routes);
  const grouped = canGroupByPrefecture(routes);

  return (
    // On a phone one column with the progress line down its left; from 768 px the cards sit in a grid of
    // two (three from 1280 px) and the line gives way to the numbers on the photos.
    <ol className="md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-6 md:px-4 xl:grid-cols-3">
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
