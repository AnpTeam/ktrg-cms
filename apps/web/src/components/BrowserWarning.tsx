"use client";

import { useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { canKeepData, isInAppBrowser } from "@/lib/browser-check";

import { buttonStyle } from "@/components/button";
const noSubscribe = () => () => {};

/**
 * For someone with no account: a warning, at the top of the page, when this browser will lose their stamps (the browser inside
 * another app, or one that keeps no cookies or storage), with a way to copy the page's address to open in Safari or Chrome. Shown
 * after the page has loaded in the browser (never while the server draws it), and it can be closed for the visit.
 */
export function BrowserWarning() {
  const { t } = useLingui();
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const risky = useSyncExternalStore(noSubscribe, () => isInAppBrowser(navigator.userAgent) || !canKeepData(), () => false);
  if (!risky || closed) return null;

  return (
    <section role="alert" className="mx-4 mb-4 flex flex-col gap-3 rounded-2xl border-2 border-caution bg-surface p-4">
      <p className="text-lg font-bold leading-snug">{t`このブラウザでは、スタンプが消えてしまうことがあります。`}</p>
      <p className="text-lg leading-7">{t`アプリの中で開いたページや、プライベートモードでは、記録が残りません。SafariかChromeで、このページを開いてください。登録しておくと、記録は消えません。`}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              // the browser refused: the address is still in its address bar
            }
          }}
          className={buttonStyle("primary", "md", "inline-flex")}
        >
          {copied ? t`コピーしました` : t`アドレスをコピー`}
        </button>
        <button type="button" onClick={() => setClosed(true)} className={buttonStyle("secondary", "md", "inline-flex")}>
          {t`閉じる`}
        </button>
      </div>
    </section>
  );
}
