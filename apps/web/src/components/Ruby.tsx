import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";

/**
 * Furigana for hard kanji, shown in Japanese only (in English the child is
 * already the translated text). Use in headings of text-2xl or larger.
 */
export function Ruby({ reading, children }: { reading: string; children: ReactNode }) {
  const { i18n } = useLingui();
  if (i18n.locale !== "ja") return children;
  return (
    <ruby>
      {children}
      <rp>(</rp>
      <rt>{reading}</rt>
      <rp>)</rp>
    </ruby>
  );
}
