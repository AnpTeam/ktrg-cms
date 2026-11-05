"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { getOutbox } from "@/lib/stamp-outbox";
import { locationAlreadyAllowed, mockPosition, mockStamp, readPosition, requestStamp } from "@/lib/stamp-client";
import { distanceParts, type Problem, type StampMock } from "@/lib/stamp-flow";
import { buzz, playThud, unlockAudio } from "@/lib/stamp-feel";
import { announceProgress, type StampProgress } from "@/lib/stamp-progress";
import { track } from "@/lib/track";
import { StampFace } from "./StampFace";
import { useStampMessages } from "./useStampMessages";
import { buttonStyle } from "@/components/button";

// The "stamp here" button of a spot page (WBS 3.3.1). One tap: explain why the position is needed (before the
// browser asks), read ONE position, send it, and show the answer in plain words. The server decides; every way it
// can go wrong has its own sentence and a way to try again. The position is sent once and never kept.

type Phase =
  | { name: "idle" }
  | { name: "explain" }
  | { name: "locating" }
  | { name: "sending" }
  | { name: "done"; already: boolean }
  | { name: "queued" }
  | { name: "problem"; problem: Problem; distanceM?: number };

const button = buttonStyle("action", "lg", "flex w-full shadow-lg");
const quietButton = buttonStyle("secondary", "lg", "flex w-full");

export function StampHere({
  spotId,
  status,
  alreadyStamped,
  stampImage,
  loginHref,
  mock,
  inSheet = false,
  progress,
  onStamped,
}: {
  spotId: string;
  status: "open" | "caution" | "closed";
  /** The visitor already holds this stamp (before this visit). */
  alreadyStamped: boolean;
  /** The place's own stamp picture, shown in the "stamped" message. */
  stampImage?: string | null;
  loginHref: string;
  /** Development only: pretend answers, see stamp-client.ts. Never set in production. */
  mock?: StampMock;
  /** Shown inside the home map's bottom sheet: it sticks to the bottom of the sheet, not above the tab bar. */
  inSheet?: boolean;
  /** Where the rally stood before this stamp: lets the popup show the ring filling. Left out when the screen does not know. */
  progress?: Omit<StampProgress, "after">;
  /** Called once the server has given (or already had) the stamp; navigation moves on to the next stop. */
  onStamped?: () => void;
}) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = phase.name === "locating" || phase.name === "sending";

  // The explanation is a native modal dialog: focus is trapped in it and Escape closes it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (phase.name === "explain" && !el.open) el.showModal();
    if (phase.name !== "explain" && el.open) el.close();
  }, [phase.name]);

  async function start() {
    unlockAudio();
    setPhase({ name: "locating" });
    const position = mock ? await mockPosition(mock) : await readPosition();
    if (!position.ok) {
      setPhase({ name: "problem", problem: position.reason });
      return;
    }
    setPhase({ name: "sending" });
    const result = mock ? await mockStamp(mock) : await requestStamp(spotId, position.reading);
    if (result.ok) {
      setPhase({ name: "done", already: result.already });
      if (!result.already) {
        playThud();
        buzz();
      }
      track("stamp", { already: result.already, finishedCourse: (result.finished?.routeIds.length ?? 0) > 0 });
      window.dispatchEvent(new Event("ktrg:stamped")); // the sign-up reminder for a visitor with no account listens
      if (!result.already && progress) announceProgress({ ...progress, after: progress.before + 1 });
      onStamped?.();
      router.refresh();
    } else if (result.failure === "network" && !mock && (await getOutbox().enqueue(spotId, position.reading, progress))) {
      // No signal: the stamp waits on this phone and is sent when the app is online (the server still decides then).
      setPhase({ name: "queued" });
    } else {
      setPhase({ name: "problem", problem: result.failure, distanceM: result.distanceM });
    }
  }

  async function press() {
    // Explain why the position is needed before the browser's own prompt; skip it once location is allowed.
    if (mock || (await locationAlreadyAllowed())) void start();
    else setPhase({ name: "explain" });
  }

  const messages = useStampMessages();

  const wrapper = inSheet ? "sticky bottom-[var(--tab-room)] z-10 flex flex-col gap-2 bg-paper/95 py-2" : "sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 px-4 md:bottom-6";

  if (phase.name === "done") {
    return (
      <div className={wrapper}>
        {phase.already ? null : <StampPress image={stampImage} />}
        <div role="status" className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-lg">
          <StampFace state="stamped" number={1} image={stampImage} rough className="stamp-land h-16 w-16 shrink-0" />
          <p className="text-xl font-bold leading-snug">{phase.already ? t`このスタンプは、もう押してあります。` : t`スタンプを押しました！`}</p>
        </div>
      </div>
    );
  }
  if (phase.name === "queued") {
    return (
      <div className={wrapper}>
        <div role="status" className="flex flex-col gap-1 rounded-3xl bg-surface p-4 shadow-lg">
          <p className="text-xl font-bold leading-snug">{t`電波が弱いか、つながらないため、あとで送ります。`}</p>
          <p className="text-base leading-snug">{t`つながると、自動で送ります。そのときにサーバーが確かめるため、受け付けられないこともあります（場所が閉鎖中になったときなど）。`}</p>
        </div>
      </div>
    );
  }
  // Already held before this visit: the page itself says so; there is nothing to press.
  if (alreadyStamped) return null;

  const distance = phase.name === "problem" && phase.problem === "too_far" && phase.distanceM !== undefined ? distanceParts(phase.distanceM) : null;
  const numberFormat = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const km = distance ? numberFormat.format(distance.value) : "";
  const m = distance ? numberFormat.format(distance.value) : "";

  return (
    <div className={wrapper}>
      {phase.name === "problem" ? (
        <div role="alert" className="flex flex-col gap-1 rounded-2xl border-2 border-caution bg-paper px-4 py-3 text-lg leading-7 shadow-lg">
          <p className="font-bold">{messages[phase.problem]}</p>
          {distance ? (
            <p className="tabular-nums">{distance.unit === "km" ? t`いまの場所から、約${km}km` : t`いまの場所から、約${m}m`}</p>
          ) : null}
          {phase.problem === "login_needed" ? (
            <Link href={loginHref} className="tap-target mt-1 inline-flex items-center font-bold text-accent underline underline-offset-4">
              {t`ログインする`}
            </Link>
          ) : null}
        </div>
      ) : null}

      {status === "closed" ? (
        <>
          <button type="button" disabled className={`${button} opacity-50`}>
            {t`スタンプを押す`}
          </button>
          <p className="rounded-xl bg-paper/95 px-3 py-1 text-center text-base text-muted">{t`この場所は、いまは閉鎖中です。`}</p>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void press()} className={button} aria-live="polite">
          {phase.name === "locating"
            ? t`いまの位置を調べています…`
            : phase.name === "sending"
              ? t`スタンプを押しています…`
              : phase.name === "problem"
                ? t`もう一度試す`
                : t`スタンプを押す`}
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="stamp-explain-title"
        onClose={() => setPhase((p) => (p.name === "explain" ? { name: "idle" } : p))}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
      >
        <h2 id="stamp-explain-title" className="text-2xl font-bold">
          {t`いまの位置を調べます`}
        </h2>
        <p className="mt-3 text-lg leading-8">{t`スタンプの場所の近くにいるか、たしかめるために、スマートフォンの位置を1回だけ調べます。`}</p>
        <p className="mt-2 text-lg leading-8">{t`位置は、保存しません。保存するのは、スタンプだけです。`}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" onClick={() => void start()} className={button}>
            {t`位置を調べてスタンプを押す`}
          </button>
          <button type="button" onClick={() => setPhase({ name: "idle" })} className={quietButton}>
            {t`やめる`}
          </button>
        </div>
      </dialog>
    </div>
  );
}

/**
 * The moment the stamp is pressed: a big seal drops onto the screen, the page gives one small thump, and an ink ring spreads
 * out. It is all CSS animation that ends invisible, so with "calm" on (animations off) nothing is drawn at all.
 */
function StampPress({ image }: { image?: string | null }) {
  return (
    <div aria-hidden="true" className="stamp-press pointer-events-none fixed inset-0 z-50 flex items-center justify-center opacity-0">
      <span className="stamp-press-ring absolute size-56 rounded-full border-8 border-shu" />
      <StampFace state="stamped" number={1} image={image} rough className="stamp-press-seal size-56 rounded-full! p-4" />
    </div>
  );
}
