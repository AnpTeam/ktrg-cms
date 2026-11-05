"use client";

import { useLingui } from "@lingui/react/macro";
import { BookmarkIcon } from "./icons";
import { useBookmarks } from "./useBookmarks";
import { buttonStyle } from "@/components/button";

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
      className={buttonStyle("secondary", "lg", "inline-flex w-full")}
    >
      <BookmarkIcon filled={saved} />
      {saved ? t`ブックマーク済み` : t`ブックマークする`}
    </button>
  );
}
