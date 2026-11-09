import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchStatuses, liveStatus, type LiveStatus, type Status } from "@/lib/navigation/status-client";

/** How often an open page asks whether a place was closed (CLAUDE.md: every 60 seconds and on focus). */
const EVERY_MS = 60_000;

/**
 * A place's status as it is now, for a page left open: asked on opening (a saved page may be old), every minute while the
 * page is in sight, and when it comes back into view. With no signal the last known one stays. The server refuses a closed
 * place either way. A change also redraws the page from the server, so its status line and warning follow too.
 */
export function useLiveStatus(spotId: string, shown: Status): Status {
  const router = useRouter();
  const [latest, setLatest] = useState<LiveStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      const status = (await fetchStatuses())?.get(spotId);
      if (!alive || !status) return;
      setLatest({ spotId, shown, status });
      if (status !== shown) router.refresh();
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
  }, [spotId, shown, router]);
  return liveStatus(latest, spotId, shown);
}
