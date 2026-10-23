"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { formatUpdated } from "@/lib/format";

interface Entry {
  id: string;
  action: string;
  targetType: string;
  actorUserId: string | null;
  createdAt: string;
}

/** What was done to this route and its waypoints, newest first. The log keeps ids only, so "by" is a short account id. */
export function RouteHistory({ routeId, locale }: { routeId: string; locale: string }) {
  const { t } = useLingui();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const words: Record<string, string> = {
    "route.create": t`ルートを作った`,
    "route.update": t`ルートを直した`,
    "route.delete": t`ルートを消した`,
    "route.reorder": t`ルートの順番を変えた`,
    "spot.create": t`経由地を作った`,
    "spot.update": t`経由地を直した`,
    "spot.delete": t`経由地を消した`,
    "spot.publish": t`経由地を公開した`,
    "spot.unpublish": t`経由地の公開をやめた`,
    "spot.reorder": t`経由地の順番を変えた`,
    "spot.status.change": t`経由地の状態を変えた`,
  };

  async function load() {
    if (entries) return;
    try {
      const res = await fetch(`/api/v1/admin/routes/${routeId}/history`, { credentials: "same-origin" });
      const json = (await res.json()) as { ok?: boolean; history?: Entry[] };
      if (json.ok && json.history) setEntries(json.history);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <details onToggle={(e) => e.currentTarget.open && void load()} className="rounded-xl border border-line bg-paper px-4 py-2">
      <summary className="cursor-pointer text-base font-bold">{t`変更の履歴`}</summary>
      <div className="mt-3">
        {failed ? <p role="alert" className="text-base font-bold text-danger">{t`履歴を読み込めませんでした。`}</p> : null}
        {entries && entries.length === 0 ? <p className="text-base">{t`まだ、履歴はありません。`}</p> : null}
        <ul className="flex flex-col gap-1 text-base">
          {(entries ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-t border-line/30 py-1 first:border-t-0">
              <span className="tabular-nums text-muted">{formatUpdated(locale, e.createdAt)}</span>
              <span className="font-bold">{words[e.action] ?? e.action}</span>
              {e.actorUserId ? <span className="text-sm text-muted">{t`担当 ${e.actorUserId.slice(0, 8)}`}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
