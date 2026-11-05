"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "./button";
import { BookmarkIcon, ShareIcon } from "./icons";
import { useBookmarks } from "./useBookmarks";

// Share the page and bookmark the route, at the end of the route page. (Print and the GPX download were taken off on
// 2026-11-05: printing a long page was not useful, and a second "download" beside the offline save confused people.)
export function ShareBookmark({ route }: { route: { id: string; nameJa: string } }) {
  const { t } = useLingui();
  const { list, toggle } = useBookmarks();
  const [copied, setCopied] = useState(false);
  const saved = list.includes(route.id);
  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: route.nameJa, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // The person closed the share sheet, or the browser refused the clipboard: nothing to do.
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 print:hidden">
      <button type="button" className={buttonStyle("secondary", "md", "inline-flex")} onClick={share}>
        <ShareIcon />
        {t`共有`}
      </button>
      <button
        type="button"
        className={buttonStyle("secondary", "md", `inline-flex ${saved ? "bg-brand! text-on-brand! border-brand!" : ""}`)}
        aria-pressed={saved}
        onClick={() => toggle(route.id)}
      >
        <BookmarkIcon filled={saved} />
        {saved ? t`ブックマーク済み` : t`ブックマークする`}
      </button>
      <span role="status" className="text-base font-bold text-muted">
        {copied ? t`リンクをコピーしました` : ""}
      </span>
    </div>
  );
}
