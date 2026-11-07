"use client";

import { useDeferredValue, type ComponentProps } from "react";
import { Landing } from "@/components/landing/Landing";
import { homeTextIn } from "@/lib/home-text";
import type { PageText } from "@/lib/page-text";
import { PreviewFrame } from "./PreviewFrame";

// The home page as a visitor will see it, drawn from what is being typed (not from what is saved). `inert`: a link
// inside must not take the editor away from unsaved text. Typing stays quick: the preview catches up a moment later.

/** What the home page shows besides its words, as a visitor sees it now. */
export type HomeData = Omit<ComponentProps<typeof Landing>, "locale" | "top" | "text">;

export function PagePreview({ text, locale, home }: { text: PageText; locale: string; home?: HomeData }) {
  const shown = useDeferredValue(text);
  return (
    <PreviewFrame locale={locale} canWiden={false}>
      {(lang) => (
        <div inert>
          {home ? <Landing {...home} locale={lang} text={homeTextIn(shown, lang)} /> : null}
        </div>
      )}
    </PreviewFrame>
  );
}
