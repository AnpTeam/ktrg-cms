"use client";

import { useEffect, useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { InfoIcon } from "./icons";

// The "this is sample and draft data" notice (shown only while sample content is on). It used to be a
// permanent banner that took a big part of a phone screen. Now it is a one-time pop-up when the app is
// opened, and an info button (in the top bar, and on the expanded map) opens the same text again.

let opener: (() => void) | null = null;

/** Opens the notice from anywhere (for example the expanded map). Does nothing if it is not on the page. */
export function openSampleNotice() {
  opener?.();
}

const seenKey = "sample-notice-seen";

/** The notice itself: a native <dialog>, so focus, Escape and the backdrop come for free. Render it once. */
export function SampleNoticeHost() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    opener = () => {
      if (!dialog.open) dialog.showModal();
    };
    try {
      // Once per browser session: a visitor sees it when the app opens, not on every page.
      if (!window.sessionStorage.getItem(seenKey)) {
        window.sessionStorage.setItem(seenKey, "1");
        dialog.showModal();
      }
    } catch {
      // Storage blocked: skip the automatic pop-up; the info button still works.
    }
    return () => {
      opener = null;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="sample-notice-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border-2 border-ink bg-paper p-5 text-ink backdrop:bg-black/60"
    >
      <h2 id="sample-notice-title" className="text-xl font-bold">
        <Trans>このデータについて</Trans>
      </h2>
      <p className="mt-3 text-lg">
        <Trans>いま表示しているのは、見本と下書きのデータです。確認前の情報を含みます。</Trans>
      </p>
      <p className="mt-2 text-lg">
        <Trans>地図のルートと場所は仮のものです。実際の公開情報ではありません。</Trans>
      </p>
      <form method="dialog" className="mt-5">
        <button
          type="submit"
          className="tap-target inline-flex w-full items-center justify-center rounded-lg bg-accent px-5 text-lg font-bold text-paper"
        >
          <Trans>閉じる</Trans>
        </button>
      </form>
    </dialog>
  );
}

/** The small info button that opens the notice. */
export function SampleNoticeButton({ className = "" }: { className?: string }) {
  const { t } = useLingui();
  return (
    <button
      type="button"
      onClick={openSampleNotice}
      aria-label={t`このデータについて`}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border-2 border-ink bg-paper text-ink hover:bg-surface [&_svg]:size-5 ${className}`}
    >
      <InfoIcon />
    </button>
  );
}
