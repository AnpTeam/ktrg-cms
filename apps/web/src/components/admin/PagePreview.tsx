"use client";

import { useDeferredValue } from "react";
import { CustomPageView, FaqView, GuideView, PolicyView, TermsView } from "@/components/pages/PageViews";
import { customPageIn, helpWith, ownText, policyWith, termsWith, type CustomPage } from "@/lib/page-content";
import type { PageKey, PageText } from "@/lib/page-text";
import { PreviewFrame } from "./PreviewFrame";

// The fixed text pages as a visitor will see them, drawn from what is being typed (not from what is saved). `inert`: a link
// inside must not take the editor away from unsaved text. Typing stays quick: the preview catches up a moment later.

function FixedPage({ pageKey, text, locale }: { pageKey: PageKey; text: PageText; locale: string }) {
  const own = ownText(text, locale);
  if (pageKey === "faq") return <FaqView help={helpWith(locale, null, own)} open />;
  if (pageKey === "guide") return <GuideView help={helpWith(locale, own, null)} />;
  if (pageKey === "terms") return <TermsView terms={termsWith(own)} locale={locale} />;
  return <PolicyView policy={policyWith(locale, own)} />;
}

export function PagePreview({ pageKey, text, locale }: { pageKey: PageKey; text: PageText; locale: string }) {
  const shown = useDeferredValue(text);
  return (
    <PreviewFrame locale={locale} canWiden={false}>
      {(lang) => (
        <div inert>
          <FixedPage pageKey={pageKey} text={shown} locale={lang} />
        </div>
      )}
    </PreviewFrame>
  );
}

/** The same for a page made in the admin (/p/<address>). */
export function CustomPagePreview({ page, locale }: { page: CustomPage; locale: string }) {
  const shown = useDeferredValue(page);
  return (
    <PreviewFrame locale={locale} canWiden={false}>
      {(lang) => (
        <div inert>
          <CustomPageView {...customPageIn(shown, lang)} />
        </div>
      )}
    </PreviewFrame>
  );
}
