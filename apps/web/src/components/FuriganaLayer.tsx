"use client";

import { useEffect } from "react";
import { startFurigana } from "@/lib/furigana-dom";

/** Draws furigana over the page's kanji while the visitor has chosen it (Japanese pages only). Renders nothing. */
export function FuriganaLayer() {
  useEffect(() => (document.documentElement.lang === "ja" ? startFurigana() : undefined), []);
  return null;
}
