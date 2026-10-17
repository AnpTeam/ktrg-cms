"use client";

import dynamic from "next/dynamic";
import { Trans } from "@lingui/react/macro";

// MapLibre needs the browser (WebGL), so only the map itself is loaded on the client (CLAUDE.md: dynamic import,
// ssr: false). The sheet around it, and the page's text, are still drawn on the server.
export const MapScreenCanvasLoader = dynamic(() => import("./MapScreenCanvas").then((m) => m.MapScreenCanvas), {
  ssr: false,
  loading: () => (
    <p className="absolute inset-0 flex items-center justify-center bg-surface text-lg">
      <Trans>地図を読み込み中…</Trans>
    </p>
  ),
});
