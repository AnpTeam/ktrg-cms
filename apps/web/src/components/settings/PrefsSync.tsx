"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { prefsCookieString, syncDirection, type Prefs } from "@/lib/prefs";

/**
 * Keeps the phone's copy and the account's copy of the visitor's choices equal, quietly, for a
 * signed-in visitor. The newer one wins (see effectivePrefs): if the phone's is newer (a change made
 * where the account could not be reached) it is sent to the account as soon as the app can reach it,
 * on the next page and again when the connection comes back; if the account's is newer it is written
 * to the phone. Shows nothing.
 */
export function PrefsSync({ signedIn, account, device }: { signedIn: boolean; account: Prefs | null; device: Prefs | null }) {
  const router = useRouter();
  const accountTime = account?.updatedAt ?? -1;
  const deviceTime = device?.updatedAt ?? -1;

  useEffect(() => {
    if (!signedIn) return;
    const direction = syncDirection(account, device);
    if (direction === "none") return;

    let cancelled = false;
    async function run() {
      if (direction === "pull" && account) {
        document.cookie = prefsCookieString(account, window.location.protocol === "https:");
      } else if (direction === "push" && device) {
        try {
          const res = await api.me.patch({ preferences: device });
          // Saved: refresh so the page reads the account's copy again. A failure is retried below.
          if (!res.error && !cancelled) router.refresh();
        } catch {
          // No signal: try again when the connection returns.
        }
      }
    }
    run();
    window.addEventListener("online", run);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
    };
    // The two copies are compared by their times; the objects themselves are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, accountTime, deviceTime]);

  return null;
}
