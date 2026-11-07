"use client";

import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { SerwistProvider, useSerwist } from "@serwist/turbopack/react";

/**
 * Registers the service worker (src/app/sw.ts) in the built app, and asks before a new version takes over: it waits until the
 * visitor taps 「更新する」, so nobody is switched to new code in the middle of a walk. Not registered in development.
 * `reloadOnOnline` is off: coming back online must not reload a page someone is using (the stamp outbox handles that moment).
 */
export function ServiceWorker() {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"} reloadOnOnline={false}>
      <UpdatePrompt />
    </SerwistProvider>
  );
}

function UpdatePrompt() {
  const { t } = useLingui();
  const { serwist } = useSerwist();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setWaiting(true);
    // A new version took over: load it. Not on a first visit, where the first worker taking the page changes nothing on it.
    const onControlling = ({ isUpdate }: { isUpdate?: boolean }) => {
      if (isUpdate) window.location.reload();
    };
    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  if (!waiting || !serwist) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.5rem+var(--top-clear))] z-40 flex items-center gap-3 rounded-2xl bg-ink p-3 text-paper shadow-2xl md:inset-x-auto md:right-6 md:w-[24rem]">
      <p className="min-w-0 flex-1 text-base font-bold leading-snug">{t`新しいバージョンがあります。`}</p>
      <button type="button" onClick={() => serwist.messageSkipWaiting()} className="tap-target shrink-0 rounded-full bg-paper px-4 text-base font-bold text-ink">
        {t`更新する`}
      </button>
    </div>
  );
}
