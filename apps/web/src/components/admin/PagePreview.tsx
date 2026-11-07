"use client";

import { useDeferredValue, type ComponentProps } from "react";
import { Landing } from "@/components/landing/Landing";
import { FaqView, GuideView, PolicyView, TermsView } from "@/components/pages/PageViews";
import { helpWith, ownText, policyWith, termsWith } from "@/lib/page-content";
import { homeTextIn } from "@/lib/home-text";
import type { PageKey, PageText } from "@/lib/page-text";
import { PreviewFrame } from "./PreviewFrame";

// The fixed text pages as a visitor will see them, drawn from what is being typed (not from what is saved). `inert`: a link
// inside must not take the editor away from unsaved text. Typing stays quick: the preview catches up a moment later.

/** What the home page shows besides its words, as a visitor sees it now. */
export type HomeData = Omit<ComponentProps<typeof Landing>, "locale" | "top" | "text">;

function FixedPage({ pageKey, text, locale, home }: { pageKey: PageKey; text: PageText; locale: string; home?: HomeData }) {
  if (pageKey === "home") return home ? <Landing {...home} locale={locale} text={homeTextIn(text, locale)} /> : null;
  const own = ownText(text, locale, pageKey === "guide");
  if (pageKey === "faq") return <FaqView help={helpWith(locale, null, own)} open />;
  if (pageKey === "guide") return <GuideView help={helpWith(locale, own, null)} />;
  if (pageKey === "terms") return <TermsView terms={termsWith(own)} locale={locale} />;
  return <PolicyView policy={policyWith(locale, own)} />;
}

export function PagePreview({ pageKey, text, locale, home }: { pageKey: PageKey; text: PageText; locale: string; home?: HomeData }) {
  const shown = useDeferredValue(text);
  return (
    <PreviewFrame locale={locale} canWiden={false}>
      {(lang) => (
        <div inert>
          <FixedPage pageKey={pageKey} text={shown} locale={lang} home={home} />
        </div>
      )}
    </PreviewFrame>
  );
}
