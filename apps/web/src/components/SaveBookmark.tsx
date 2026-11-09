"use client";

import { useLingui } from "@lingui/react/macro";
import { BookmarkIcon } from "./icons";
import { useBookmarks } from "./useBookmarks";
import { buttonStyle } from "@/components/button";

/** Saves a rally or a blog post to the bookmarks (one list with the routes: on the account when signed in, on the device when not). */
export function SaveBookmark({ id, wide = true }: { id: string; wide?: boolean }) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  const saved = list.includes(id);
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={saved}
      className={buttonStyle("secondary", wide ? "lg" : "md", wide ? "inline-flex w-full" : "inline-flex w-fit")}
    >
      <BookmarkIcon filled={saved} />
      {saved ? t`ブックマーク済み` : t`ブックマークする`}
    </button>
  );
}
