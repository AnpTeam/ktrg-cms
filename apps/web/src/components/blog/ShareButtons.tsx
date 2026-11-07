"use client";

import { useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";

const noop = () => () => {};
const url = () => window.location.href;
const canShare = () => typeof navigator.share === "function";

/**
 * Share a post: the phone's own share sheet where there is one, a copy-the-link button, and LINE and X. The address is the
 * page's own, read in the browser; until then (and on the server) the buttons that need it wait.
 */
export function ShareButtons({ title }: { title: string }) {
  const { t } = useLingui();
  const href = useSyncExternalStore(noop, url, () => "");
  const native = useSyncExternalStore(noop, canShare, () => false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const button = buttonStyle("secondary", "sm", "inline-flex");

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setManual(true);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t`この記事を共有する`}>
      {native ? (
        <button type="button" className={button} onClick={() => void navigator.share({ title, url: href }).catch(() => {})}>
          {t`共有する`}
        </button>
      ) : null}
      <button type="button" className={button} disabled={!href} onClick={() => void copy()} aria-live="polite">
        {copied ? t`コピーしました` : t`リンクをコピー`}
      </button>
      <a className={button} aria-disabled={!href} target="_blank" rel="noopener noreferrer" href={href ? `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(href)}` : undefined}>
        LINE
      </a>
      <a className={button} aria-disabled={!href} target="_blank" rel="noopener noreferrer" href={href ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(href)}&text=${encodeURIComponent(title)}` : undefined}>
        X
      </a>
      {manual ? (
        <label className="w-full text-base">
          {t`このリンクをコピーしてください`}
          <input readOnly value={href} autoFocus onFocus={(e) => e.currentTarget.select()} className="tap-target mt-1 block w-full rounded border border-ink bg-paper px-3 text-ink" />
        </label>
      ) : null}
    </div>
  );
}
