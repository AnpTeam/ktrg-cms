"use client";

import type { MouseEvent, ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { BookmarkButton } from "@/components/BookmarkButton";

/**
 * The course page's sticky bar on a phone: the bookmark, then the titles of its folds. A title opens its fold and scrolls to
 * it (the folds are closed at first, so a plain #link would land on a shut heading). From a wide box everything is open and
 * the bar is not shown. Each target is an element with an id that holds one <details>.
 */
export function FoldJumps({ routeId, items }: { routeId: string | null; items: { id: string; label: ReactNode }[] }) {
  const { t } = useLingui();

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
      {routeId ? (
        <div className="shrink-0 pl-4 pr-2">
          <BookmarkButton routeId={routeId} compact />
        </div>
      ) : null}
      <ul className="flex min-w-0 gap-4 overflow-x-auto px-2 [scrollbar-width:none]">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a href={`#${item.id}`} onClick={(e) => jump(e, item.id)} className="tap-target inline-flex items-center text-lg font-bold text-ink hover:underline">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
