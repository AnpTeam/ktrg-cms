"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";

// The video links a route had before (kept each time the link is replaced or removed), so a mistake can be put back.
// Putting one back only fills the field: the editor still saves it like any other change.
export function VideoHistory({ routeId, onPick }: { routeId: string; onPick: (url: string) => void }) {
  const { t } = useLingui();
  const [urls, setUrls] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setFailed(false);
    try {
      const res = await fetch(`/api/v1/admin/routes/${routeId}/video-history`, { credentials: "same-origin" });
      const json = (await res.json()) as { ok?: boolean; urls?: string[] };
      if (json.ok && json.urls) setUrls(json.urls);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <details onToggle={(e) => e.currentTarget.open && void load()} className="rounded-xl border border-line bg-paper px-4 py-2">
      <summary className="cursor-pointer text-base font-bold">{t`前の動画のリンク`}</summary>
      <div className="mt-2">
        {failed ? <p role="alert" className="text-base font-bold text-danger">{t`読み込めませんでした。`}</p> : null}
        {urls === null && !failed ? <p className="text-base text-muted">{t`読み込み中…`}</p> : null}
        {urls?.length === 0 ? <p className="text-base text-muted">{t`前のリンクは、まだありません。`}</p> : null}
        {urls && urls.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {urls.map((url) => (
              <li key={url} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 break-all text-base">{url}</span>
                <button type="button" onClick={() => onPick(url)} className="tap-target rounded-full bg-surface px-4 text-base font-bold text-accent">
                  {t`このリンクに戻す`}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
