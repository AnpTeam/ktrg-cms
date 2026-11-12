import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import type { SpotListItem } from "@/lib/content";
import { pickText } from "@/lib/pick-text";
import { plainRich } from "@/lib/rich-text";
import type { NodeState } from "@/lib/ribbon";
import type { WalkRow } from "@/lib/route-stops";
import { ChevronIcon } from "./icons";
import { Localized } from "./Localized";
import { PointKindName } from "./PointKindName";
import { RoutePhoto } from "./RoutePhoto";
import { StatusWord } from "./StatusWord";
import { TrailNode } from "./TrailNode";
import { offersNoStamp } from "@/lib/spot-status";

// The places of one route, drawn like the trail on the route list: a numbered node per place and a line between them, so
// the list reads as the order of the walk. Every place has its own page. A stamp place's node shows its state (seal =
// stamped, ring = not yet, plain ring when signed out, dashed ring = closed right now); a place without a stamp (a toilet,
// a station ...) has a plain ring and is marked "no stamp". A side trip (寄り道) has no number, only a small dashed dot.
// Each is a card: photo, name, its whole description and, when it is not open, the editor's note, so the walk reads on
// this one page without opening each place (older visitors would rather scroll than tap in and back). The start and the goal carry a badge; a walk that comes
// back to its start lists that place again at the end as the goal (both rows lead to its one page, with the same stamp).
// Between two places on the way: how far it is along the line (or the boat or bus ride the editor gave).

const COLUMN = "3.25rem"; // the node column; the line runs through its middle
const NODE_CENTER = "2.125rem"; // the row has 0.75rem above the 44 px node

function nodeFor(spot: SpotListItem): NodeState {
  if (offersNoStamp(spot.status)) return "soon";
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

/** A dot for a place with no number: dashed for a side trip, solid for a place without a stamp. */
function SideNode({ solid = false }: { solid?: boolean }) {
  return (
    <span aria-hidden="true" className="grid size-11 place-items-center">
      <span className={`size-5 rounded-full border-[3px] border-line bg-paper ${solid ? "" : "border-dashed"}`} />
    </span>
  );
}

function Card({ photo, alt, children }: { photo: string | null; alt: string; children: ReactNode }) {
  return (
    <span className="my-1.5 block overflow-hidden rounded-2xl bg-surface group-hover:bg-[color-mix(in_srgb,var(--color-muted)_14%,var(--color-surface))]">
      {photo ? (
        <span className="relative block aspect-[16/9]">
          <RoutePhoto src={photo} alt={alt} />
        </span>
      ) : null}
      <span className="flex items-start justify-between gap-3 p-3">
        <span className="min-w-0">{children}</span>
        <span className="shrink-0 pt-1 text-muted">
          <ChevronIcon />
        </span>
      </span>
    </span>
  );
}

const chip = "rounded-lg border-2 border-dashed border-line px-2 text-base font-bold";

const ROLE_BADGE = { start: "", goal: "badge-goal", turnaround: "badge-goal" } as const;

export function StopList({ rows, hrefFor, locale }: { rows: WalkRow[]; hrefFor: (id: string) => string; locale: string }) {
  const ids = useId();
  // The walk so far: the line is moss up to the last stamped place.
  const stampedUpTo = rows.reduce<boolean[]>((acc, { stop: s }) => [...acc, s.type === "stamp" ? s.spot.stamped === true : (acc[acc.length - 1] ?? false)], []);
  return (
    <ol>
      {rows.map(({ stop, key, role, legKm }, index) => {
        const hasNext = index < rows.length - 1;
        const doneAbove = index > 0 && stampedUpTo[index - 1] === true;
        const done = stampedUpTo[index] === true;
        const before = rows[index - 1]?.stop;
        const item = stop.type === "stamp" ? stop.spot : stop.point;
        const name = pickText(locale, item.nameJa, item.nameEn);
        const description = pickText(locale, item.descriptionJa ?? null, item.descriptionEn ?? null);
        const photo = item.photoUrl ?? null;
        const sideTrip = item.stopBy === true;
        const node =
          stop.number !== null && stop.type === "stamp" ? <TrailNode state={nodeFor(stop.spot)} order={stop.number} share={0} /> : <SideNode solid={!sideTrip} />;
        return (
          <li key={key} className="relative">
            {index > 0 ? <Segment done={doneAbove} from="0" to={`calc(100% - ${NODE_CENTER})`} /> : null}
            {hasNext ? <Segment done={done} from={NODE_CENTER} to="0" /> : null}
            <Leg km={legKm} spot={stop.type === "stamp" && before?.type === "stamp" ? stop.spot : null} />
            {/* Named by the place name alone: the whole card stays one big tap target, but a screen reader does not read the description as the link's name. */}
            <Link href={hrefFor(item.id)} aria-labelledby={`${ids}-${index}`} className="tap-target group relative grid items-start" style={{ gridTemplateColumns: `${COLUMN} 1fr` }}>
              <span className="flex justify-center pt-3">{node}</span>
              <Card photo={photo} alt={name?.text ?? ""}>
                {role ? (
                  <span className={`badge-ruri badge-small mb-1 ${ROLE_BADGE[role]}`}>
                    {role === "start" ? <Trans>スタート</Trans> : role === "goal" ? <Trans>ゴール</Trans> : <Trans>折り返し</Trans>}
                  </span>
                ) : null}
                <span id={`${ids}-${index}`} className="block text-xl font-bold leading-snug">
                  <Localized value={name} />
                </span>
                {stop.type === "point" || sideTrip ? (
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {stop.type === "point" ? (
                      <>
                        <span className={chip}>
                          <Trans>スタンプなし</Trans>
                        </span>
                        <span className="text-lg text-muted">
                          <PointKindName kind={stop.point.kind} />
                        </span>
                      </>
                    ) : null}
                    {sideTrip ? (
                      <span className={chip}>
                        <Trans>寄り道</Trans>
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {description && description.text.trim() ? (
                  <span className="mt-1 block whitespace-pre-line text-lg leading-7">
                    <span lang={description.lang}>{plainRich(description.text)}</span>
                  </span>
                ) : null}
                {stop.type === "stamp" ? <StampMeta spot={stop.spot} locale={locale} /> : null}
              </Card>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Between two rows: how far from the place before. A boat, bus or train ride the editor set between two stamp places is
 * said as that ride; otherwise the distance along the line, with the walking time when the editor's leg gives one.
 */
function Leg({ km, spot }: { km: number | null; spot: SpotListItem | null }) {
  const minutes = spot?.fromPrev?.minutes;
  const mode = spot?.fromPrev?.mode;
  const ride = minutes !== undefined && mode !== undefined; // no mode = on foot
  const shownKm = km ?? (spot?.fromPrev && mode === undefined ? spot.fromPrev.km : null);
  if (!ride && shownKm === null) return null;
  return (
    <p className="text-base text-muted tabular-nums" style={{ paddingLeft: COLUMN }}>
      {ride ? (
        mode === "ferry" ? (
          <Trans>船で約{minutes}分</Trans>
        ) : mode === "bus" ? (
          <Trans>バスで約{minutes}分</Trans>
        ) : mode === "train" ? (
          <Trans>電車で約{minutes}分</Trans>
        ) : (
          <Trans>乗り物で約{minutes}分</Trans>
        )
      ) : minutes !== undefined ? (
        <Trans>{shownKm} km・歩いて約{minutes}分</Trans>
      ) : (
        <Trans>{shownKm} km</Trans>
      )}
    </p>
  );
}

/** The status and the stamp, and the editor's note when the place is not simply open. */
function StampMeta({ spot, locale }: { spot: SpotListItem; locale: string }) {
  const note = spot.status === "open" ? null : pickText(locale, spot.statusNoteJa ?? null, spot.statusNoteEn ?? null);
  return (
    <>
    <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg">
      <StatusWord status={spot.status} />
      {spot.stamped === true ? (
        <span className="font-bold text-ink">
          <Trans>押した</Trans>
        </span>
      ) : null}
    </span>
    {note && note.text.trim() ? (
      <span lang={note.lang} className="mt-2 block rounded-xl bg-paper p-3 text-lg leading-7">
        {note.text}
      </span>
    ) : null}
    </>
  );
}
