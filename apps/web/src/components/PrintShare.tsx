"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BookmarkIcon, PrintIcon, ShareIcon } from "./icons";
import { useBookmarks } from "./useBookmarks";

// Print (the browser can save it as a PDF), share and bookmark the page, as icon buttons. Bookmark sits at the far
// end of the row. The layout hides its menus when printing.
export function PrintShare({ route }: { route: { id: string; nameJa: string } }) {
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
  const button = "tap-target flex size-12 items-center justify-center rounded-full bg-surface text-accent hover:bg-paper";
  return (
    <div className="flex items-center gap-2 px-4 print:hidden">
      <button type="button" className={button} aria-label={t`印刷・PDF`} title={t`印刷・PDF`} onClick={() => window.print()}>
        <PrintIcon />
      </button>
      <button type="button" className={button} aria-label={t`共有`} title={t`共有`} onClick={share}>
        <ShareIcon />
      </button>
      <span role="status" className="text-base font-bold text-muted">
        {copied ? t`リンクをコピーしました` : ""}
      </span>
      <button
        type="button"
        className={`${button} ml-auto ${saved ? "bg-brand! text-on-brand" : ""}`}
        aria-pressed={saved}
        aria-label={saved ? t`ブックマークをはずす` : t`ブックマークする`}
        title={saved ? t`ブックマークをはずす` : t`ブックマークする`}
        onClick={() => toggle(route.id)}
      >
        <BookmarkIcon filled={saved} />
      </button>
    </div>
  );
}
