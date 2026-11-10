"use client";

import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "./button";
import { ShareIcon } from "./icons";

// Share the page, at the end of the route page. (Print and the GPX download were taken off on 2026-11-05: printing a
// long page was not useful, and a second "download" beside the offline save confused people. The bookmark lives in the
// page's jump bar: BookmarkButton.)
export function ShareRoute({ route }: { route: { nameJa: string } }) {
  const { t } = useLingui();
  // A count, not a flag: a second copy restarts the 2.5 s, and leaving the page clears the timer.
  const [copied, setCopied] = useState(0);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(0), 2500);
    return () => clearTimeout(id);
  }, [copied]);
  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: route.nameJa, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied((n) => n + 1);
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
      <span role="status" className="text-base font-bold text-muted">
        {copied ? t`リンクをコピーしました` : ""}
      </span>
    </div>
  );
}
