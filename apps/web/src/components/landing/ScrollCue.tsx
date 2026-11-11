"use client";

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { ChevronDownIcon } from "@/components/icons";
import { cueVisible } from "@/lib/landing-story";

/**
 * "There is more below": a small arrow and the word at the bottom of the first screen, gone once the visitor has scrolled
 * (docs/landing-story-design.md). The arrow bobs only when motion is allowed (`.scroll-cue-arrow` in globals.css).
 */
export function ScrollCue() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onScroll = () => setVisible(cueVisible(window.scrollY));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex md:bottom-6 flex-col items-center gap-1 text-white transition-opacity duration-300 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}>
      <span className="text-base font-bold [text-shadow:0_1px_6px_rgb(0_0_0/0.7)]">
        <Trans>スクロール</Trans>
      </span>
      <span className="scroll-cue-arrow [filter:drop-shadow(0_1px_4px_rgb(0_0_0/0.6))]">
        <ChevronDownIcon />
      </span>
    </div>
  );
}
