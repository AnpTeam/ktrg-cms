"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { api } from "@/lib/api";
import { fetchMyStamps } from "@/lib/stamp-client";
import { primaryButton, secondaryButton } from "@/components/auth/authUi";
import { buttonStyle } from "@/components/button";

type Step = { name: "idle" } | { name: "ask"; mine: number; guest: number } | { name: "moved"; added: number };

/**
 * For a signed-in visitor who still holds stamps from before they had an account (the guest cookie). With nothing on the
 * account yet they simply move over. With stamps on both sides they choose: keep both, or keep only the account's.
 */
export function GuestClaim() {
  const { t } = useLingui();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [busy, setBusy] = useState(false);

  async function claim(mode: "merge" | "account") {
    setBusy(true);
    try {
      const res = await api.guest.claim.post({ mode });
      setStep(res.data && mode === "merge" && res.data.added > 0 ? { name: "moved", added: res.data.added } : { name: "idle" });
    } catch {
      setStep({ name: "idle" }); // offline: the guest stamps stay in the cookie and are offered again next visit
    }
    setBusy(false);
    router.refresh();
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const [mine, guest] = await Promise.all([
        fetchMyStamps(),
        fetch("/api/v1/guest/stamps", { credentials: "same-origin" }).then((r) => r.json() as Promise<{ stamps?: unknown[] }>).catch(() => null),
      ]);
      const held = guest?.stamps?.length ?? 0;
      if (!live || held === 0) return;
      if (!mine || mine.size === 0) await claim("merge");
      else setStep({ name: "ask", mine: mine.size, guest: held });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const wanted = step.name !== "idle";
    if (wanted && !el.open) el.showModal();
    if (!wanted && el.open) el.close();
  }, [step.name]);

  return (
    <dialog ref={dialog} aria-labelledby="guest-claim-title" onClose={() => setStep({ name: "idle" })} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60">
      {step.name === "ask" ? (
        <>
          <h2 id="guest-claim-title" className="text-2xl font-bold leading-snug">
            {t`この端末と、アカウントの、どちらのスタンプを残しますか？`}
          </h2>
          <p className="mt-3 text-lg leading-8">{t`この端末に ${step.guest} 個、アカウントに ${step.mine} 個のスタンプがあります。`}</p>
          <div className="mt-5 flex flex-col gap-3">
            <button type="button" disabled={busy} onClick={() => claim("merge")} className={primaryButton}>
              {t`両方を合わせる（おすすめ）`}
            </button>
            <button type="button" disabled={busy} onClick={() => claim("account")} className={secondaryButton}>
              {t`アカウントのものだけにする`}
            </button>
          </div>
        </>
      ) : step.name === "moved" ? (
        <>
          <h2 id="guest-claim-title" className="text-2xl font-bold leading-snug">
            {t`スタンプを ${step.added} 個、アカウントに移しました。`}
          </h2>
          <button type="button" onClick={() => setStep({ name: "idle" })} className={buttonStyle("primary", "lg", "mt-5 flex w-full")}>
            {t`閉じる`}
          </button>
        </>
      ) : null}
    </dialog>
  );
}
