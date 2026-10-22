import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import type { Journey, TrailStop } from "@/lib/route-stops";
import { pickText } from "@/lib/pick-text";
import type { WalkStyle } from "@/lib/walk-style";
import { Localized } from "./Localized";

// Where the walk starts and where it ends, as badges joined by a dashed line. The saved walk style picks the layout:
//   one way        Start, line, Goal; "how to get back is in the notes below"
//   round trip     one Start / Goal badge: it ends where it began
//   out and back   Start / Goal, line, the turnaround place: the same way there and back
// With no style saved and a goal close to the start, the page names the two places and claims nothing more.

export function stopName(stop: TrailStop, locale: string) {
  return stop.type === "stamp" ? pickText(locale, stop.spot.nameJa, stop.spot.nameEn) : pickText(locale, stop.point.nameJa, stop.point.nameEn);
}

/** The small word that says how the walk goes: 片道, 周回 or 往復. */
export function WalkStyleChip({ style, className = "" }: { style: WalkStyle; className?: string }) {
  return (
    <span className={`inline-block rounded-lg border-2 border-ink px-2 font-bold ${className}`}>
      {style === "loop" ? <Trans>周回</Trans> : style === "out_and_back" ? <Trans>往復</Trans> : <Trans>片道</Trans>}
    </span>
  );
}

/** One badge and the name of the place it marks: blue for the start, orange for the goal and the turnaround. */
function Row({ badge, stop, locale, tone = "start" }: { badge: ReactNode; stop: TrailStop; locale: string; tone?: "start" | "goal" }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`badge-ruri ${tone === "goal" ? "badge-goal" : ""} min-w-[8.5rem] justify-center`}>{badge}</span>
      <span className="min-w-0 text-xl font-bold leading-snug">
        <Localized value={stopName(stop, locale)} />
      </span>
    </div>
  );
}

/** The dashed line between two badges (its middle is under the middle of a badge). */
function Connector({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="ml-[calc(4.25rem-2px)] h-6 border-l-4 border-dashed border-line" />
      {children ? <span className="text-lg text-muted">{children}</span> : null}
    </div>
  );
}

export function RouteJourney({ journey, locale }: { journey: Journey; locale: string }) {
  const { start, goal, style, turnaround } = journey;
  const note = "text-lg";
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      {style === "loop" ? (
        <>
          <Row badge={<Trans>スタート・ゴール</Trans>} stop={start} locale={locale} />
          <p className={note}>
            <WalkStyleChip style="loop" className="mr-2" />
            <Trans>出発した場所に戻ってくる道です。</Trans>
          </p>
        </>
      ) : style === "out_and_back" ? (
        <>
          <Row badge={<Trans>スタート・ゴール</Trans>} stop={start} locale={locale} />
          {turnaround ? (
            <>
              <Connector>
                <Trans>行き</Trans> ↓ ↑ <Trans>帰り</Trans>
              </Connector>
              <Row badge={<Trans>折り返し</Trans>} stop={turnaround} locale={locale} tone="goal" />
            </>
          ) : null}
          <p className={note}>
            <WalkStyleChip style="out_and_back" className="mr-2" />
            <Trans>同じ道を行って、同じ道を戻ります。</Trans>
          </p>
        </>
      ) : (
        <>
          <Row badge={<Trans>スタート</Trans>} stop={start} locale={locale} />
          {goal ? (
            <>
              <Connector />
              <Row badge={<Trans>ゴール</Trans>} stop={goal} locale={locale} tone="goal" />
            </>
          ) : null}
          {style === "one_way" ? (
            <p className={note}>
              <WalkStyleChip style="one_way" className="mr-2" />
              <Trans>帰りの方法は、下の交通の説明を見てください。</Trans>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
