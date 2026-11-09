import { useEffect, useState } from "react";
import { fetchStatuses, liveStatus, type LiveStatus, type Status } from "@/lib/navigation/status-client";

/** How often an open page asks whether a place was closed (CLAUDE.md: every 60 seconds and on focus). */
const EVERY_MS = 60_000;

/**
 * A place's status as it is now, for a page left open: asked on opening (a saved page may be old), every minute while the
 * page is in sight, and when it comes back into view. With no signal the last known one stays. The server refuses a closed
 * place either way; this only stops the button from offering it.
 */
export function useLiveStatus(spotId: string, shown: Status): Status {
  const [latest, setLatest] = useState<LiveStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      const status = (await fetchStatuses())?.get(spotId);
      if (alive && status) setLatest({ spotId, shown, status });
    };
    void check();
    const timer = setInterval(() => void check(), EVERY_MS);
    const onShow = () => void check();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [spotId, shown]);
  return liveStatus(latest, spotId, shown);
}
