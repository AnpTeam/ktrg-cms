"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";

// Print (the browser can save it as a PDF) and share the page. The layout hides its menus when printing.
export function PrintShare({ title }: { title: string }) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = async () => {
    const url = window.location.href;
    try {
      if (canShare) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // The person closed the share sheet, or the browser refused the clipboard: nothing to do.
    }
  };
  const button = "rounded-full bg-surface px-4 py-2 text-sm font-bold text-accent";
  return (
    <div className="flex gap-2 px-4 print:hidden">
      <button type="button" className={button} onClick={() => window.print()}>
        {t`印刷・PDF`}
      </button>
      <button type="button" className={button} onClick={share}>
        {copied ? t`リンクをコピーしました` : t`共有`}
      </button>
    </div>
  );
}
