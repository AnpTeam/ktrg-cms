"use client";

import { useEffect } from "react";

// A little more than --top-clear: the photo's bottom fades into the page, so the strip takes over from it unseen.
const TOP_ZONE_PX = 100;

/**
 * Once the route page's cover photo has left the top of the screen, <body> gets `cover-gone`, and the solid strip of the
 * installed app comes back (globals.css, .status-strip), so the text scrolling up is not blurred behind the status bar.
 */
export function CoverWatch() {
  useEffect(() => {
    const cover = document.querySelector("[data-cover]");
    if (!cover) return;
    const observer = new IntersectionObserver(([entry]) => document.body.classList.toggle("cover-gone", !(entry?.isIntersecting ?? true)), { rootMargin: `-${TOP_ZONE_PX}px 0px 0px 0px` });
    observer.observe(cover);
    return () => {
      observer.disconnect();
      document.body.classList.remove("cover-gone");
    };
  }, []);
  return null;
}
