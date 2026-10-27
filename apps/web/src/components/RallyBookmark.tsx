"use client";

import { useLingui } from "@lingui/react/macro";
import { BookmarkIcon } from "./icons";
import { useBookmarks } from "./useBookmarks";

/** Saves the rally to the bookmarks (the same list as the routes: on the account when signed in, on the device when not). */
export function RallyBookmark({ rallyId }: { rallyId: string }) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  const saved = list.includes(rallyId);
  return (
    <button
      type="button"
      onClick={() => toggle(rallyId)}
      aria-pressed={saved}
      className="tap-target inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-ink bg-paper px-6 text-xl font-bold text-ink hover:bg-surface"
    >
      <BookmarkIcon filled={saved} />
      {saved ? t`ブックマーク済み` : t`ブックマークする`}
    </button>
  );
}
