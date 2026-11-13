"use client";

import { useDeferredValue, useEffect, useState, type ComponentProps } from "react";
import { useLingui } from "@lingui/react/macro";
import { Landing } from "@/components/landing/Landing";
import { homeTextIn } from "@/lib/home-text";
import type { PageText } from "@/lib/page-text";
import { PreviewFrame } from "./PreviewFrame";

// The home page as a visitor will see it, drawn from what is being typed (not from what is saved). `inert`: a link
// inside must not take the editor away from unsaved text. Typing stays quick: the preview catches up a moment later.

/** What the home page shows besides its words, as a visitor sees it now. */
export type HomeData = Omit<ComponentProps<typeof Landing>, "locale" | "top" | "text">;

export function PagePreview({ text, locale, home }: { text: PageText; locale: string; home?: HomeData }) {
  const { t } = useLingui();
  const shown = useDeferredValue(text);
  const [calm, setCalm] = useState(false);
  // Phone: the page in a phone-shaped frame (a narrow box makes the page choose its phone layout); else the full width of the screen.
  const [phone, setPhone] = useState(false);
  // "No animation" is the visitor's calm setting: the page reads it from <html> when it starts, so the page is started again
  // (key) and the setting is put back as it was when the switch goes off or the tab closes.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.hasAttribute("data-calm");
    if (calm) root.setAttribute("data-calm", "");
    return () => {
      if (!before) root.removeAttribute("data-calm");
    };
  }, [calm]);
  const pill = "rounded-full bg-surface px-3 py-2.5 text-sm font-bold aria-pressed:bg-selected aria-pressed:text-on-selected";
  const buttons = (
    <>
      <button type="button" aria-pressed={!phone} onClick={() => setPhone(false)} className={pill}>
        {t`パソコン幅`}
      </button>
      <button type="button" aria-pressed={phone} onClick={() => setPhone(true)} className={pill}>
        {t`スマホ幅`}
      </button>
      <button type="button" aria-pressed={calm} onClick={() => setCalm(!calm)} className={pill}>
        {t`動きなし`}
      </button>
    </>
  );
  return (
    <PreviewFrame locale={locale} canWiden={false} plain={!phone} extra={buttons}>
      {(lang) => (
        <div inert key={`${lang}-${calm}-${phone}`}>
          {home ? <Landing {...home} locale={lang} text={homeTextIn(shown, lang)} /> : null}
        </div>
      )}
    </PreviewFrame>
  );
}
