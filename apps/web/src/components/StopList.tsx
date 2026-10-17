import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { pickText, type SpotListItem } from "@/lib/content";
import type { NodeState } from "@/lib/ribbon";
import { ChevronIcon } from "./icons";
import { Localized } from "./Localized";
import { StatusWord } from "./StatusWord";
import { TrailNode } from "./TrailNode";

// The stamp places of one route (WBS 3.2.8), drawn like the trail on the route list: a numbered node per stop and a
// line between them, so the list reads as the order of the walk. The state is the node's shape, not its colour:
// seal = stamped, ring = not yet, plain ring when signed out, dashed ring = closed right now.

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

export function StopList({ spots, hrefFor, locale }: { spots: SpotListItem[]; hrefFor: (spot: SpotListItem) => string; locale: string }) {
  return (
    <ol>
      {spots.map((spot, index) => {
        const previous = spots[index - 1];
        const hasNext = index < spots.length - 1;
        const doneAbove = previous?.stamped === true;
        const done = spot.stamped === true;
        return (
          <li key={spot.id} className="relative">
            {previous ? <Segment done={doneAbove} from="0" to={`calc(100% - ${NODE_CENTER})`} /> : null}
            {hasNext ? <Segment done={done} from={NODE_CENTER} to="0" /> : null}
            <Link href={hrefFor(spot)} className="tap-target group relative grid items-start" style={{ gridTemplateColumns: `${COLUMN} 1fr` }}>
              <span className="flex justify-center pt-3">
                <TrailNode state={nodeFor(spot)} order={index + 1} share={0} />
              </span>
              <span className="flex items-center justify-between gap-3 rounded-xl py-3 pr-1 group-hover:bg-surface">
                <span className="min-w-0">
                  <span className="block text-xl font-bold leading-snug">
                    <Localized value={pickText(locale, spot.nameJa, spot.nameEn)} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg">
                    <StatusWord status={spot.status} />
                    {spot.stamped === true ? (
                      <span className="font-bold text-ink">
                        <Trans>押した</Trans>
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-muted">
                  <ChevronIcon />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
