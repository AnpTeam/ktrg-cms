"use client";

import { useEffect, useRef } from "react";
import { progressOf } from "@/lib/landing-story";

/**
 * A short marker inset from the right edge (a full-height strip beside the real scrollbar looked like a second scrollbar) that fills as the visitor goes through the story, from the top of the page to the start
 * chapter (the element marked `data-story-end`; the whole page until there is one), so a long page never looks as if it has ended. It follows the scroll directly (no
 * animation), so it is also fine with reduced motion. Decoration for the eye: hidden from screen readers.
 */
export function ScrollProgress() {
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const end = document.querySelector("[data-story-end]");
      const bottom = end ? end.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight - window.innerHeight;
      if (fill.current) fill.current.style.transform = `scaleY(${progressOf(window.scrollY, 0, bottom)})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-y-1/4 right-1.5 z-20 w-[3px] overflow-hidden rounded-full bg-line/40 print:hidden">
      <span ref={fill} className="block size-full origin-top bg-brand" style={{ transform: "scaleY(0)" }} />
    </div>
  );
}
