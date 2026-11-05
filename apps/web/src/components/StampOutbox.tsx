"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { fetchMyStamps } from "@/lib/stamp-client";
import { buzz, playThud } from "@/lib/stamp-feel";
import { announceProgress, progressFromAccepted } from "@/lib/stamp-progress";
import { getOutbox, usePendingStamps } from "@/lib/stamp-outbox";
import type { StampFailure } from "@/lib/stamp-flow";
import { useStampMessages } from "./useStampMessages";
import { TickIcon } from "@/components/icons";
import { buttonStyle } from "@/components/button";

/**
 * Sends the stamps that were pressed with no signal (docs/phase-b-offline-plan.md, B3). Tries when the page opens, when the
 * phone comes back online and when the app returns to the front (never in the background: browsers do not allow it), and
 * by a button. Shows how many are waiting, and, once, why any were refused: the server decides, so a stamp can be refused
 * after the visitor has left the place.
 */
export function StampOutbox({ userKey }: { userKey: string }) {
  const { t } = useLingui();
  const router = useRouter();
  const messages = useStampMessages();
  const pending = usePendingStamps();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<StampFailure[]>([]);
  // How many waiting stamps the server just took: said for a few seconds, so the visitor sees that the wait paid off.
  const [accepted, setAccepted] = useState(0);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const { result } = await getOutbox().flush();
      if (!result) return;
      const took = result.outcomes.filter((o) => o.kind === "accepted" && !o.already).length;
      if (took > 0) {
        setAccepted(took);
        playThud();
        buzz();
        for (const p of progressFromAccepted(result.outcomes)) announceProgress(p); // the ring popup, as for a stamp pressed with signal
        window.dispatchEvent(new Event("ktrg:stamped")); // the sign-up reminder for a visitor with no account listens
      }
      // Also when the server already had it (a request that timed out here may still have been taken): the pages show it.
      if (result.outcomes.some((o) => o.kind === "accepted")) router.refresh();
      const bad = result.outcomes.flatMap((o) => (o.kind === "rejected" ? [o.failure === "expired" ? ("stale_scan" as const) : o.failure] : []));
      if (bad.length > 0) setRefused((r) => [...r, ...bad]);
    } finally {
      setBusy(false);
    }
  }, [router]);

  // Stamps pressed with no signal before signing in wait as "guest". Signed in now: with nothing on the account yet they
  // simply move over (the same rule as GuestClaim); with stamps already on it the visitor chooses first.
  const [ask, setAsk] = useState<{ guest: number; mine: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (ask && !el.open) el.showModal();
    if (!ask && el.open) el.close();
  }, [ask]);

  useEffect(() => {
    let live = true;
    (async () => {
      const outbox = getOutbox();
      await outbox.setUser(userKey);
      if (userKey !== "guest") {
        const guest = await outbox.guestWaiting();
        if (guest > 0) {
          const mine = await fetchMyStamps(); // null (offline): asked again next time
          if (mine && mine.size === 0) await outbox.adoptGuest();
          else if (mine && live) setAsk({ guest, mine: mine.size });
        }
      }
      if (live) void run();
    })();
    return () => {
      live = false;
    };
  }, [userKey, run]);

  async function answer(send: boolean) {
    setAsk(null);
    if (send) await getOutbox().adoptGuest();
    else await getOutbox().discardGuest();
    void run();
  }

  useEffect(() => {
    if (accepted === 0) return;
    const timer = setTimeout(() => setAccepted(0), 6000);
    return () => clearTimeout(timer);
  }, [accepted]);

  // With a weak signal the phone is "online" and no event ever says it is back, so while stamps wait (and the screen is on)
  // the page tries again every half minute.
  const waiting = pending > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void run(), 30_000);
    return () => clearInterval(timer);
  }, [waiting, run]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void run();
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [run]);

  const reasons = [...new Set(refused)];
  const count = refused.length;
  const askDialog = (
    <dialog
      ref={dialog}
      aria-labelledby="outbox-ask-title"
      onClose={() => setAsk(null)}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
    >
      <h2 id="outbox-ask-title" className="text-2xl font-bold">
        {t`登録なしで押したスタンプがあります`}
      </h2>
      {ask ? (
        <p className="mt-3 text-lg leading-8">{t`電波がなくて送れなかったスタンプが${ask.guest}件あります。このアカウントには、すでに${ask.mine}個のスタンプがあります。このアカウントに送りますか？`}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={() => void answer(true)} className={buttonStyle("action", "lg", "flex w-full shadow-lg")}>
          {t`このアカウントに送る`}
        </button>
        <button type="button" onClick={() => void answer(false)} className={buttonStyle("secondary", "lg", "flex w-full")}>
          {t`送らずに捨てる`}
        </button>
      </div>
    </dialog>
  );

  if (pending === 0 && refused.length === 0 && accepted === 0) return askDialog;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+var(--nav-toast,0px)+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 md:inset-x-auto md:bottom-[calc(1.5rem+var(--nav-toast,0px))] md:right-6 md:w-[24rem]">
      {refused.length > 0 ? (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 border-caution bg-paper p-4 shadow-2xl">
          <p className="text-lg font-bold leading-snug">{t`送信待ちだった${count}件のスタンプは、受け付けられませんでした。`}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-base leading-snug">
            {reasons.map((r) => (
              <li key={r}>{messages[r]}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setRefused([])} className={buttonStyle("secondary", "md", "flex w-full")}>
            {t`閉じる`}
          </button>
        </div>
      ) : null}
      {accepted > 0 ? (
        <div role="status" className="flex items-center gap-3 rounded-2xl border-2 border-moss bg-paper p-4 shadow-2xl">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-moss text-paper">
            <TickIcon size={20} />
          </span>
          <p className="text-lg font-bold leading-snug">{t`送信待ちだったスタンプが、${accepted}件、受け付けられました！`}</p>
        </div>
      ) : null}
      {pending > 0 ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-paper p-4 shadow-2xl ring-1 ring-line/30">
          <p className="text-lg font-bold leading-snug tabular-nums">{t`${pending}件のスタンプが、送信待ちです。`}</p>
          <p className="text-base leading-snug text-muted">{t`つながると、自動で送ります。つながりにくいときは、30秒ごとにもう一度試します。`}</p>
          <button type="button" disabled={busy} onClick={() => void run()} className={buttonStyle("action", "md", "flex w-full")}>
            {busy ? t`送っています…` : t`いま送る`}
          </button>
        </div>
      ) : null}
      {askDialog}
    </div>
  );
}
