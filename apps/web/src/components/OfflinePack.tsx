"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import type { RouteArea } from "@/lib/map-screen";
import type { MapSettings } from "@/lib/map-settings";
import { CheckIcon, DownloadIcon } from "./icons";
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
  const secondary = "tap-target flex-1 rounded-lg border-2 border-line bg-paper px-4 text-lg font-bold text-ink hover:bg-surface";
  const percent = progress ? Math.min(100, Math.round((progress.done / Math.max(1, progress.total)) * 100)) : 0;

  return (
    <section aria-labelledby="offline-pack" className="flex flex-col gap-3 rounded-lg bg-surface p-4 print:hidden">
      <h2 id="offline-pack" className="flex items-center gap-2 text-xl font-bold">
        <span aria-hidden="true" className="text-accent">
          <DownloadIcon />
        </span>
        {t`オフラインで使う`}
      </h2>
      {progress ? (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-lg font-bold">{t`地図を保存しています… ${percent}%`}</p>
          <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-moss" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : pack ? (
        <>
          <p className="flex items-center gap-2 text-lg font-bold text-moss">
            <CheckIcon />
            {t`保存済み`}
            <span className="text-base font-normal text-muted">{t`（${ageText}・${megabytes(pack.bytes)} MB）`}</span>
          </p>
          <p className="text-base text-muted">{t`電波がなくても、この道の地図が開きます。`}</p>
          <div className="flex gap-2">
            <button type="button" onClick={save} className={secondary}>
              {t`更新`}
            </button>
            <button type="button" onClick={remove} className={secondary}>
              {t`削除`}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-base text-muted">{t`山では電波が届かないことがあります。入口で保存しておくと、電波がなくてもこの道の地図が開きます（数MB）。`}</p>
          <button type="button" onClick={save} className="tap-target w-full rounded-lg bg-brand px-5 text-lg font-bold text-on-brand">
            {t`地図を保存`}
          </button>
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
