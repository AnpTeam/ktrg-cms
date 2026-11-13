"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { BookmarkButton } from "@/components/BookmarkButton";
import { BOOKMARK_ANCHOR } from "@/lib/page-anchors";

/**
 * The course page's sticky bar on a phone: the bookmark, then the titles of its folds. A title opens its fold and scrolls to
 * it (the folds are closed at first, so a plain #link would land on a shut heading). From a wide box everything is open and
 * the bar is not shown. The links are spaced by their own padding, not a gap: a tap target's 3rem minimum width left a short title (歴史) with empty space after it. Each target is an element with an id that holds one <details>.
 */
/** True when the element has scrolled up past the top of the screen (not when it is merely below the fold). */
function useScrolledAbove(id: string): boolean {
  const [above, setAbove] = useState(false);
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => setAbove(!!entry && !entry.isIntersecting && entry.boundingClientRect.bottom < 0));
    watch.observe(el);
    return () => watch.disconnect();
  }, [id]);
  return above;
}

export function FoldJumps({ routeId, items }: { routeId: string | null; items: { id: string; label: ReactNode }[] }) {
  const { t } = useLingui();
  const scrolledAbove = useScrolledAbove(BOOKMARK_ANCHOR);

  function jump(e: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const details = target.querySelector("details");
    if (details) details.open = true;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  }

  return (
    // Solid background on purpose: a see-through bar at the top edge brings back iOS's status-bar blur (globals.css).
    <nav aria-label={t`このページの項目`} className="sticky top-[var(--top-clear)] z-20 order-3 flex items-center border-b border-line/30 bg-paper py-1 @4xl:hidden">
      {/* Beside the title list but out of the way at first: it grows in when the bookmark button above has scrolled off. */}
      {routeId ? (
        <div className={`shrink-0 transition-[max-width,opacity] motion-reduce:transition-none ${scrolledAbove ? "max-w-20 overflow-visible pl-4 pr-2 opacity-100" : "max-w-0 overflow-hidden opacity-0"}`} inert={!scrolledAbove}>
          <BookmarkButton routeId={routeId} compact />
        </div>
      ) : null}
      <ul className="flex min-w-0 overflow-x-auto px-1 [scrollbar-width:none]">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a href={`#${item.id}`} onClick={(e) => jump(e, item.id)} className="tap-target inline-flex min-w-0! items-center px-3 text-lg font-bold text-ink hover:underline">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
