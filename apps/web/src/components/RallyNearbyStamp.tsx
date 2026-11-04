"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { pickText } from "@/lib/pick-text";
import { distanceParts, type Problem } from "@/lib/stamp-flow";
import { nearestToStamp, type RallyPlace } from "@/lib/rally-nearby";
import { buzz, playThud, unlockAudio } from "@/lib/stamp-feel";
import { getOutbox } from "@/lib/stamp-outbox";
import { locationAlreadyAllowed, readPosition, requestStamp } from "@/lib/stamp-client";
import { announceProgress } from "@/lib/stamp-progress";
import { track } from "@/lib/track";
import { useStampMessages } from "./useStampMessages";

type Phase =
  | { name: "idle" }
  | { name: "explain" }
  | { name: "working"; what: "locating" | "sending" }
  | { name: "done"; place: string; already: boolean }
  | { name: "queued"; place: string }
  | { name: "none"; place: string; distanceM: number }
  | { name: "problem"; problem: Problem; distanceM?: number };

/**
 * "Stamp here" for a whole rally: when the visitor is at one of its places they can press it from the rally page, without
 * opening the place first. One tap reads ONE position, picks the nearest place they do not hold yet, and asks the server
 * for that stamp: the server still decides (distance, accuracy, closed). The position is used once and never kept.
 */
export function RallyNearbyStamp({ places, held, locale, rallyName, quiet = false }: { places: RallyPlace[]; held: string[]; locale: string; rallyName: string; quiet?: boolean }) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const messages = useStampMessages();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const busy = phase.name === "working";
  const nameOf = (p: RallyPlace) => pickText(locale, p.nameJa, p.nameEn)?.text ?? p.nameJa;
  const format = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });

  // Say why the position is needed before the browser asks (the same explanation as a place's own button), unless location is already allowed.
  // The explanation is a native modal dialog: focus is trapped in it and Escape closes it.
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (phase.name === "explain" && !el.open) el.showModal();
    if (phase.name !== "explain" && el.open) el.close();
  }, [phase.name]);

  async function press() {
    if (await locationAlreadyAllowed()) void start();
    else setPhase({ name: "explain" });
  }

  async function start() {
    unlockAudio();
    setPhase({ name: "working", what: "locating" });
    const position = await readPosition();
    if (!position.ok) return setPhase({ name: "problem", problem: position.reason });
    const found = nearestToStamp(position.reading, places, new Set(held));
    if (!found) return setPhase({ name: "idle" });
    if (!found.near) return setPhase({ name: "none", place: nameOf(found.place), distanceM: found.distanceM });
    setPhase({ name: "working", what: "sending" });
    const result = await requestStamp(found.place.id, position.reading);
    if (!result.ok && result.failure === "network" && (await getOutbox().enqueue(found.place.id, position.reading))) return setPhase({ name: "queued", place: nameOf(found.place) });
    if (!result.ok) return setPhase({ name: "problem", problem: result.failure, distanceM: result.distanceM });
    setPhase({ name: "done", place: nameOf(found.place), already: result.already });
    if (!result.already) {
      playThud();
      buzz();
    }
    track("stamp", { already: result.already, finishedCourse: (result.finished?.routeIds.length ?? 0) > 0, from: "rally" });
    window.dispatchEvent(new Event("ktrg:stamped"));
    if (!result.already) announceProgress({ rallyName, before: held.length, after: held.length + 1, total: places.length, place: nameOf(found.place) });
    router.refresh();
  }

  const away = (metres: number) => {
    const d = distanceParts(metres);
    const n = format.format(d.value);
    return d.unit === "km" ? t`約${n}km` : t`約${n}m`;
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void press()}
        aria-live="polite"
        className={`tap-target flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-xl font-bold disabled:opacity-60 ${quiet ? "border border-ink bg-paper text-ink hover:bg-surface" : "bg-ink text-paper"}`}
      >
        {phase.name === "working" ? (phase.what === "locating" ? t`いまの位置を調べています…` : t`スタンプを押しています…`) : t`近くのスタンプを押す`}
      </button>
      <p className="text-base text-muted">{t`場所の近くで押してください。位置は1回だけ調べ、保存しません。`}</p>
      <dialog
        ref={dialog}
        aria-labelledby="rally-explain-title"
        onClose={() => setPhase((p) => (p.name === "explain" ? { name: "idle" } : p))}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
      >
        <h2 id="rally-explain-title" className="text-2xl font-bold">
          {t`いまの位置を調べます`}
        </h2>
        <p className="mt-3 text-lg leading-8">{t`スタンプの場所の近くにいるか、たしかめるために、スマートフォンの位置を1回だけ調べます。`}</p>
        <p className="mt-2 text-lg leading-8">{t`位置は、保存しません。保存するのは、スタンプだけです。`}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" onClick={() => void start()} className="tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-ink px-6 text-xl font-bold text-paper shadow-lg">
            {t`位置を調べてスタンプを押す`}
          </button>
          <button type="button" onClick={() => setPhase({ name: "idle" })} className="tap-target flex min-h-14 w-full items-center justify-center rounded-xl border border-ink bg-paper px-6 text-xl font-bold text-ink hover:bg-surface">
            {t`やめる`}
          </button>
        </div>
      </dialog>
      {phase.name === "done" ? (
        <p role="status" className="rounded-2xl bg-surface p-4 text-xl font-bold leading-snug">
          {phase.already ? t`「${phase.place}」のスタンプは、もう押してあります。` : t`「${phase.place}」のスタンプを押しました！`}
        </p>
      ) : null}
      {phase.name === "queued" ? (
        <p role="status" className="rounded-2xl bg-surface p-4 text-lg font-bold leading-snug">
          {t`電波がないため、「${phase.place}」のスタンプは、あとで送ります。そのときに受け付けられないこともあります。`}
        </p>
      ) : null}
      {phase.name === "none" ? (
        <p role="alert" className="rounded-2xl border-2 border-caution bg-paper p-4 text-lg font-bold leading-7">
          {t`近くにスタンプの場所がありません。いちばん近いのは「${phase.place}」で、${away(phase.distanceM)}です。`}
        </p>
      ) : null}
      {phase.name === "problem" ? (
        <p role="alert" className="rounded-2xl border-2 border-caution bg-paper p-4 text-lg font-bold leading-7">
          {messages[phase.problem]}
          {phase.problem === "too_far" && phase.distanceM !== undefined ? ` ${away(phase.distanceM)}` : ""}
        </p>
      ) : null}
    </div>
  );
}
