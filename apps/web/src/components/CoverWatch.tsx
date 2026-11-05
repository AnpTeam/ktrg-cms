"use client";

import { useEffect } from "react";

/**
 * While the route page's cover photo still reaches the status bar, <body> gets `cover-in-view`: the installed app's
 * status strip steps aside so the photo runs up behind the Dynamic Island (globals.css). Past the photo the strip
 * returns, so plain page content never scrolls under the status bar.
 */
export function CoverWatch() {
  useEffect(() => {
    const cover = document.querySelector("[data-cover]");
    if (!cover) return;
    // The cover counts until its bottom passes about the status bar's height (60 px) from the top.
    const observer = new IntersectionObserver(([entry]) => document.body.classList.toggle("cover-in-view", entry?.isIntersecting ?? false), { rootMargin: "-60px 0px 0px 0px" });
    observer.observe(cover);
    return () => {
      observer.disconnect();
      document.body.classList.remove("cover-in-view");
    };
  }, []);
  return null;
}
