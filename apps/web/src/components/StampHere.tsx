"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { locationAlreadyAllowed, mockPosition, mockStamp, readPosition, requestStamp } from "@/lib/stamp-client";
import { distanceParts, type Problem, type StampMock } from "@/lib/stamp-flow";
import { StampFace } from "./StampFace";

// The "stamp here" button of a spot page (WBS 3.3.1). One tap: explain why the position is needed (before the
// browser asks), read ONE position, send it, and show the answer in plain words. The server decides; every way it
// can go wrong has its own sentence and a way to try again. The position is sent once and never kept.

type Phase =
  | { name: "idle" }
  | { name: "explain" }
  | { name: "locating" }
  | { name: "sending" }
  | { name: "done"; already: boolean }
  | { name: "problem"; problem: Problem; distanceM?: number };

const button = "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-brand px-6 text-xl font-bold text-on-brand shadow-lg disabled:opacity-60";
const quietButton = "tap-target flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-ink bg-paper px-6 text-xl font-bold text-ink hover:bg-surface disabled:opacity-60";

export function StampHere({
  spotId,
  status,
  alreadyStamped,
  loginHref,
  mock,
  inSheet = false,
}: {
  spotId: string;
  status: "open" | "caution" | "closed";
  /** The visitor already holds this stamp (before this visit). */
  alreadyStamped: boolean;
  loginHref: string;
  /** Development only: pretend answers, see stamp-client.ts. Never set in production. */
  mock?: StampMock;
  /** Shown inside the home map's bottom sheet: it sticks to the bottom of the sheet, not above the tab bar. */
  inSheet?: boolean;
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
      router.refresh();
    } else {
      setPhase({ name: "problem", problem: result.failure, distanceM: result.distanceM });
    }
  }

  async function press() {
    // Explain why the position is needed before the browser's own prompt; skip it once location is allowed.
    if (mock || (await locationAlreadyAllowed())) void start();
    else setPhase({ name: "explain" });
  }

  const messages: Record<Problem, string> = {
    unsupported: t`この端末・ブラウザでは、位置情報を使えません。`,
    denied: t`位置情報が許可されていません。ブラウザの設定で、このサイトの位置情報を「許可」にしてから、もう一度お試しください。`,
    unavailable: t`いまの位置が、わかりません。空の開けた場所で、もう一度お試しください。`,
    timeout: t`位置を調べるのに、時間がかかっています。空の開けた場所で、もう一度お試しください。`,
    too_far: t`まだ、この場所から遠いようです。場所の近くで、もう一度お試しください。`,
    low_accuracy: t`GPSの電波が弱いようです。空の開けた場所に動いて、もう一度お試しください。`,
    spot_closed: t`この場所は、いまは閉鎖中です。スタンプは押せません。`,
    rally_not_active: t`このラリーは、いまは行われていません。`,
    not_ready: t`スタンプを押す機能は、まだ使えません。`,
    login_needed: t`ログインが切れたようです。ログインしなおしてください。`,
    too_many_requests: t`短い間に何度も操作されました。しばらくしてからお試しください。`,
    network: t`通信できませんでした。電波の良い場所でもう一度お試しください。`,
    failed: t`問題が発生しました。しばらくしてからもう一度お試しください。`,
  };

  const wrapper = inSheet ? "sticky bottom-[var(--tab-room)] z-10 flex flex-col gap-2 bg-paper/95 py-2" : "sticky bottom-24 z-10 flex flex-col gap-2 px-4 md:bottom-6";

  if (phase.name === "done") {
    return (
      <div className={wrapper}>
        <div role="status" className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-lg">
          <StampFace state="stamped" number={1} rough className="stamp-land h-16 w-16 shrink-0" />
          <p className="text-xl font-bold leading-snug">{phase.already ? t`このスタンプは、もう押してあります。` : t`スタンプを押しました！`}</p>
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
