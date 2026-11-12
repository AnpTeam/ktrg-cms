"use client";

import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BookmarkIcon } from "./icons";
import { useBookmarks } from "./useBookmarks";

/**
 * Bookmark one route. `compact`: the icon alone (the phone's jump bar, where there is no room for a word); a short
 * note under it says what happened, so the word is still given. Otherwise the icon with its word. Saved = filled red.
 */
export function BookmarkButton({ routeId, compact = false }: { routeId: string; compact?: boolean }) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  const saved = list.includes(routeId);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = saved ? t`ブックマーク済み` : t`ブックマークする`;
  const press = () => {
    toggle(routeId);
    setNote(saved ? t`ブックマークをはずしました` : t`ブックマークしました`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2500);
  };
  const look = saved ? "border-selected bg-selected text-on-selected" : "border-ink bg-paper text-ink hover:bg-surface";
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        onClick={press}
        className={`tap-target inline-flex items-center justify-center gap-2 rounded-full border font-bold ${compact ? "px-0" : "px-5 text-lg"} ${look}`}
      >
        <BookmarkIcon filled={saved} />
        {compact ? null : label}
      </button>
      <span role="status" className={compact ? "absolute left-0 top-full z-10 mt-2 whitespace-nowrap" : "ml-3 self-center"}>
        {note ? <span className={`text-base font-bold ${compact ? "rounded-lg bg-ink px-3 py-1.5 text-paper shadow-lg" : "text-muted"}`}>{note}</span> : null}
      </span>
    </span>
  );
}
