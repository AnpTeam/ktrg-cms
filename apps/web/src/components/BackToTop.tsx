"use client";

import { Trans } from "@lingui/react/macro";
import { ChevronUpIcon } from "@/components/icons";

/** "Back to top" at the end of a long page: a round-ended button, smooth only when the visitor allows motion. */
export function BackToTop() {
  const go = () => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-calm");
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  };
  return (
    <button type="button" onClick={go} className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink px-6 text-lg font-bold @[34rem]:w-fit">
      <ChevronUpIcon />
      <Trans>ページの先頭へ</Trans>
    </button>
  );
}
