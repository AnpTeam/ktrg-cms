"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RouteArea } from "@/lib/map-screen";
import type { MapSettings } from "@/lib/map-settings";
import { deletePack, megabytes, packAge, packTileUrls, readPack, savePack, type PackInfo } from "@/lib/offline-pack";

const noSubscribe = () => () => {};

// Keeps the map around a course on the phone, for walking where there is no signal (lib/offline-pack.ts; the worker
// serves the tiles). Only in the built site, where the worker runs. The visitor chooses; nothing is saved unasked.
export function OfflinePack({ routeId, area, settings }: { routeId: string; area: RouteArea | null; settings: Pick<MapSettings, "base" | "terrain"> }) {
  const { t } = useLingui();
  const [pack, setPack] = useState<PackInfo | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  // The clock is read when a pack is loaded or saved, not while drawing, so the age text stays steady between renders.
  const [now, setNow] = useState(0);
  // False while the server draws the page, so the first browser render matches it.
  const supported = useSyncExternalStore(noSubscribe, () => process.env.NODE_ENV === "production" && "serviceWorker" in navigator && "caches" in window, () => false);

  useEffect(() => {
    if (supported) void readPack(routeId).then((p) => {
      setPack(p);
      setNow(Date.now());
    });
  }, [supported, routeId]);

  if (!supported || !area) return null;

  const save = async () => {
    setFailed(false);
    setProgress({ done: 0, total: 1 });
    try {
      const urls = packTileUrls(area, settings);
      setPack(await savePack(routeId, urls, (done, total) => setProgress({ done, total })));
      setNow(Date.now());
      // Asks the browser to keep the map when space runs short. It may say no; nothing relies on it.
      void navigator.storage?.persist?.();
    } catch {
      setPack(null);
      setFailed(true);
    }
    setProgress(null);
  };

  const remove = async () => {
    await deletePack(routeId);
    setPack(null);
  };

  const age = pack ? packAge(pack.savedAt, now) : null;
  const ageText = !age ? "" : age.unit === "minute" ? t`たった今` : age.unit === "hour" ? t`${age.n}時間前` : t`${age.n}日前`;
  const button = "tap-target rounded-full bg-surface px-4 text-base font-bold text-accent disabled:opacity-60";

  return (
    <section className="flex flex-col gap-2 px-4 print:hidden" aria-label={t`オフラインの地図`}>
      {progress ? (
        <p role="status" className="text-base font-bold text-ink">
          {t`地図を保存しています… ${progress.done}/${progress.total}`}
        </p>
      ) : pack ? (
        <>
          <p className="text-base text-ink">{t`この道の地図を保存済み（${ageText}・${megabytes(pack.bytes)} MB）。電波がなくても地図が開きます。`}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} className={button}>
              {t`地図を更新`}
            </button>
            <button type="button" onClick={remove} className={button}>
              {t`地図を削除`}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-base text-muted">{t`山では電波が届かないことがあります。入口で保存しておくと、この道の地図が電波なしでも開きます（数MB）。`}</p>
          <div>
            <button type="button" onClick={save} className={button}>
              {t`オフライン用に地図を保存`}
            </button>
          </div>
        </>
      )}
      {failed ? (
        <p role="alert" className="text-base font-bold text-danger">
          {t`保存できませんでした。電波の良い場所でもう一度お試しください。`}
        </p>
      ) : null}
    </section>
  );
}
