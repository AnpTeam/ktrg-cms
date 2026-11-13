"use client";

import dynamic from "next/dynamic";

/** Loaded apart, and only by the page editors: the rest of the admin, and every visitor, never downloads the editor. */
export const BlockEditorLoader = dynamic(() => import("./BlockEditor").then((m) => m.BlockEditor), {
  ssr: false,
  loading: () => <div className="min-h-72 animate-pulse rounded-xl border border-line bg-paper" aria-busy="true" />,
});
