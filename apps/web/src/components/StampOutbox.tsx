"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { fetchMyStamps } from "@/lib/stamp-client";
import { getOutbox, usePendingStamps } from "@/lib/stamp-outbox";
import type { StampFailure } from "@/lib/stamp-flow";
import { useStampMessages } from "./useStampMessages";

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

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const { result } = await getOutbox().flush();
      if (!result) return;
      if (result.outcomes.some((o) => o.kind === "accepted" && !o.already)) {
        window.dispatchEvent(new Event("ktrg:stamped")); // the sign-up reminder for a visitor with no account listens
        router.refresh(); // the pages show the new stamps
      }
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
        <button type="button" onClick={() => void answer(true)} className="tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-ink px-6 text-xl font-bold text-paper shadow-lg">
          {t`このアカウントに送る`}
        </button>
        <button type="button" onClick={() => void answer(false)} className="tap-target flex min-h-14 w-full items-center justify-center rounded-xl border border-ink bg-paper px-6 text-xl font-bold text-ink hover:bg-surface">
          {t`送らずに捨てる`}
        </button>
      </div>
    </dialog>
  );

  if (pending === 0 && refused.length === 0) return askDialog;

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
          <button type="button" onClick={() => setRefused([])} className="tap-target flex min-h-12 w-full items-center justify-center rounded-xl border border-ink bg-paper px-4 text-lg font-bold text-ink hover:bg-surface">
            {t`閉じる`}
          </button>
        </div>
      ) : null}
      {pending > 0 ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-paper p-4 shadow-2xl ring-1 ring-line/30">
          <p className="text-lg font-bold leading-snug tabular-nums">{t`${pending}件のスタンプが、送信待ちです。`}</p>
          <p className="text-base leading-snug text-muted">{t`電波のある場所で、自動で送ります。`}</p>
          <button type="button" disabled={busy} onClick={() => void run()} className="tap-target flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-4 text-lg font-bold text-paper disabled:opacity-60">
            {busy ? t`送っています…` : t`いま送る`}
          </button>
        </div>
      ) : null}
      {askDialog}
    </div>
  );
}
