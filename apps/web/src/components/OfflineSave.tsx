"use client";

import { useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RouteArea } from "@/lib/map-screen";
import { tileUrls } from "@/lib/offline-tiles";

const noSubscribe = () => () => {};

type Phase = "idle" | "saving" | "done" | "failed";

// Keeps this page and the map around the course on the phone, for walking where there is no signal (public/sw.js serves them).
// Only in the built site: during development the saved scripts would go stale.
export function OfflineSave({ area, tileTemplate }: { area: RouteArea | null; tileTemplate: string }) {
  const { t } = useLingui();
  const [phase, setPhase] = useState<Phase>("idle");
  // False while the server draws the page, so the first browser render matches it.
  const supported = useSyncExternalStore(noSubscribe, () => process.env.NODE_ENV === "production" && "serviceWorker" in navigator, () => false);
  if (!supported || !area) return null;

  const save = async () => {
    setPhase("saving");
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const pages = await caches.open("ktrg-pages");
      const res = await fetch(window.location.pathname, { cache: "reload" });
      if (!res.ok) throw new Error("page");
      await pages.put(window.location.pathname, res);
      // The scripts and styles this page already loaded came before the worker took over, so keep them too.
      const statics = await caches.open("ktrg-static");
      const own = performance.getEntriesByType("resource").map((e) => e.name).filter((n) => new URL(n).pathname.startsWith("/_next/static/"));
      await Promise.all(own.map((n) => statics.add(n).catch(() => undefined)));
      const tiles = await caches.open("ktrg-tiles");
      const urls = tileUrls(area, tileTemplate);
      // A few at a time, so the tile server is not hammered.
      for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map((u) => tiles.add(u).catch(() => undefined)));
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  };

  return (
    <div className="px-4 print:hidden">
      <button type="button" disabled={phase === "saving"} onClick={save} className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-accent disabled:opacity-60">
        {phase === "saving" ? t`保存しています…` : phase === "done" ? t`保存しました（電波がなくても開けます）` : t`オフラインで使う`}
      </button>
      {phase === "failed" ? <p role="alert" className="mt-1 text-base font-bold text-danger">{t`保存できませんでした。電波の良い場所でもう一度お試しください。`}</p> : null}
    </div>
  );
}
