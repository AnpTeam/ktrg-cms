"use client";

import dynamic from "next/dynamic";
import { Trans } from "@lingui/react/macro";

// MapLibre needs the browser (WebGL), so the map is loaded on the client only (CLAUDE.md:
// dynamic import with ssr: false). The fallback keeps the page from jumping while it loads.
export const TrailMapLoader = dynamic(() => import("./TrailMap").then((m) => m.TrailMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[28rem] items-center justify-center rounded-2xl bg-surface text-lg">
      <Trans>地図を読み込み中…</Trans>
    </div>
  ),
});
