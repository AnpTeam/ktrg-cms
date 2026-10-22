import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import type { SpotListItem } from "@/lib/content";
import { pickText } from "@/lib/pick-text";
import type { NodeState } from "@/lib/ribbon";
import type { TrailStop } from "@/lib/route-stops";
import { ChevronIcon } from "./icons";
import { Localized } from "./Localized";
import { PointKindName } from "./PointKindName";
import { RoutePhoto } from "./RoutePhoto";
import { StatusWord } from "./StatusWord";
import { TrailNode } from "./TrailNode";

// The places of one route, drawn like the trail on the route list: a node per place and a line between them, so the list
// reads as the order of the walk. A stamp place has a numbered node (seal = stamped, ring = not yet, plain ring when signed
// out, dashed ring = closed right now) and its own page. A place without a stamp (a toilet, a station ...) has a small
// dashed dot, is marked "no stamp" and has no page. Each is a card: photo, name, and the start of its description.

const COLUMN = "3.25rem"; // the node column; the line runs through its middle
const NODE_CENTER = "2.125rem"; // the row has 0.75rem above the 44 px node

function nodeFor(spot: SpotListItem): NodeState {
  if (spot.status === "closed") return "soon";
  if (spot.stamped === null) return "neutral";
  return spot.stamped ? "complete" : "notStarted";
}

function Segment({ done, from, to }: { done: boolean; from: string; to: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -translate-x-1/2 border-l-4 ${done ? "border-moss" : "border-line"}`}
      style={{ left: `calc(${COLUMN} / 2)`, top: from, bottom: to }}
    />
  );
}

function PointNode() {
  return (
    <span aria-hidden="true" className="grid size-11 place-items-center">
      <span className="size-5 rounded-full border-[3px] border-dashed border-line bg-paper" />
    </span>
  );
}

function Card({ photo, alt, children, chevron }: { photo: string | null; alt: string; children: ReactNode; chevron: boolean }) {
  return (
    <span className="my-1.5 block overflow-hidden rounded-2xl bg-surface group-hover:bg-[color-mix(in_srgb,var(--color-muted)_14%,var(--color-surface))]">
      {photo ? (
        <span className="relative block aspect-[16/9]">
          <RoutePhoto src={photo} alt={alt} />
        </span>
      ) : null}
      <span className="flex items-start justify-between gap-3 p-3">
        <span className="min-w-0">{children}</span>
        {chevron ? (
          <span className="shrink-0 pt-1 text-muted">
            <ChevronIcon />
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function StopList({ stops, hrefFor, locale }: { stops: TrailStop[]; hrefFor: (spot: SpotListItem) => string; locale: string }) {
  // The walk so far: the line is moss up to the last stamped place.
  const stampedUpTo = stops.reduce<boolean[]>((acc, s) => [...acc, s.type === "stamp" ? s.spot.stamped === true : (acc[acc.length - 1] ?? false)], []);
  return (
    <ol>
      {stops.map((stop, index) => {
        const hasNext = index < stops.length - 1;
        const doneAbove = index > 0 && stampedUpTo[index - 1] === true;
        const done = stampedUpTo[index] === true;
        const before = stops[index - 1];
        const name = stop.type === "stamp" ? pickText(locale, stop.spot.nameJa, stop.spot.nameEn) : pickText(locale, stop.point.nameJa, stop.point.nameEn);
        const description = stop.type === "stamp" ? pickText(locale, stop.spot.descriptionJa ?? null, stop.spot.descriptionEn ?? null) : pickText(locale, stop.point.descriptionJa, stop.point.descriptionEn);
        const photo = (stop.type === "stamp" ? stop.spot.photoUrl : stop.point.photoUrl) ?? null;
        const key = stop.type === "stamp" ? stop.spot.id : stop.point.id;
        const body = (
          <Card photo={photo} alt={name?.text ?? ""} chevron={stop.type === "stamp"}>
            <span className="block text-xl font-bold leading-snug">
              <Localized value={name} />
            </span>
            {stop.type === "point" ? (
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-lg border-2 border-dashed border-line px-2 text-base font-bold">
                  <Trans>スタンプなし</Trans>
                </span>
                <span className="text-lg text-muted">
                  <PointKindName kind={stop.point.kind} />
                </span>
              </span>
            ) : null}
            {description && description.text.trim() ? (
              <span className="mt-1 line-clamp-3 text-lg leading-7">
                <Localized value={description} tag={false} />
              </span>
            ) : null}
            {stop.type === "stamp" ? <StampMeta spot={stop.spot} afterStamp={before?.type === "stamp"} /> : null}
          </Card>
        );
        return (
          <li key={key} className="relative">
            {index > 0 ? <Segment done={doneAbove} from="0" to={`calc(100% - ${NODE_CENTER})`} /> : null}
            {hasNext ? <Segment done={done} from={NODE_CENTER} to="0" /> : null}
            {stop.type === "stamp" ? (
              <Link href={hrefFor(stop.spot)} className="tap-target group relative grid items-start" style={{ gridTemplateColumns: `${COLUMN} 1fr` }}>
                <span className="flex justify-center pt-3">
                  <TrailNode state={nodeFor(stop.spot)} order={stop.number} share={0} />
                </span>
                {body}
              </Link>
            ) : (
              <div className="group relative grid items-start" style={{ gridTemplateColumns: `${COLUMN} 1fr` }}>
                <span className="flex justify-center pt-3">
                  <PointNode />
                </span>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The walk from the stop before (only when that stop is the stamp place the time was worked out from), the status and the stamp. */
function StampMeta({ spot, afterStamp }: { spot: SpotListItem; afterStamp: boolean }) {
  const minutes = spot.fromPrev?.minutes;
  const km = spot.fromPrev?.km;
  const mode = spot.fromPrev?.mode;
  return (
    <>
      {afterStamp && minutes !== undefined ? (
        <span className="mt-1 block text-lg text-muted">
          {mode === "ferry" ? (
            <Trans>前の場所から、船で約{minutes}分</Trans>
          ) : mode === "bus" ? (
            <Trans>前の場所から、バスで約{minutes}分</Trans>
          ) : mode === "train" ? (
            <Trans>前の場所から、電車で約{minutes}分</Trans>
          ) : mode === "other" ? (
            <Trans>前の場所から、乗り物で約{minutes}分</Trans>
          ) : (
            <Trans>前の場所から、歩いて約{minutes}分（{km} km）</Trans>
          )}
        </span>
      ) : null}
      <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg">
        <StatusWord status={spot.status} />
        {spot.stamped === true ? (
          <span className="font-bold text-ink">
            <Trans>押した</Trans>
          </span>
        ) : null}
      </span>
    </>
  );
}
