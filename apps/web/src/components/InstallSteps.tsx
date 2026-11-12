"use client";

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { isInAppBrowser } from "@/lib/browser-check";

const big = "tap-target flex min-h-12 w-full items-center justify-center rounded-full px-6 text-xl font-bold";

type InstallPrompt = Event & { prompt: () => Promise<unknown> };

/**
 * How to put the app on the home screen (see MDN, "Making PWAs installable"). Where the browser offers an install prompt
 * (Chrome and Edge, Android and desktop) a button asks for it; on an iPhone or iPad the way is Safari's share menu, which no
 * page can open, so the steps are written out; a browser inside another app (LINE ...) cannot add it at all. Only drawn
 * after the person has asked for it (InstallNudge), so it never runs on the server.
 */
export function InstallSteps({ titleId }: { titleId: string }) {
  const [offer, setOffer] = useState<InstallPrompt | null>(null);
  const [ua] = useState(() => navigator.userAgent);
  const ios = /\b(iPhone|iPad|iPod)\b/.test(ua) || (/\bMacintosh\b/.test(ua) && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const onOffer = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini bar away: the button below asks instead
      setOffer(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onOffer);
    return () => window.removeEventListener("beforeinstallprompt", onOffer);
  }, []);
  return (
    <>
      <h2 id={titleId} className="font-serif text-3xl font-bold text-accent">
        <Trans>ホーム画面に追加しましょう</Trans>
      </h2>
      <p className="text-lg leading-8">
        <Trans>ホーム画面に追加すると、アプリのようにすぐ開けます。山の中でも、探す手間がかかりません。</Trans>
      </p>
      {isInAppBrowser(ua) ? (
        <p className="rounded-[1.75rem] bg-surface p-4 text-lg leading-8">
          <Trans>いま開いているのは、ほかのアプリの中のブラウザです。Safari や Chrome で開きなおしてから、追加してください。</Trans>
        </p>
      ) : offer ? (
        <button type="button" onClick={() => void offer.prompt()} className={`${big} bg-ink text-paper`}>
          <Trans>ホーム画面に追加する</Trans>
        </button>
      ) : ios ? (
        <ol className="flex list-decimal flex-col gap-3 rounded-[1.75rem] bg-surface p-4 pl-9 text-lg leading-8">
          <li><Trans>Safari で、画面の下（または上）にある共有ボタン（□に↑）を押します。</Trans></li>
          <li><Trans>メニューを下へ動かして、「ホーム画面に追加」を押します。</Trans></li>
          <li><Trans>右上の「追加」を押すと、できあがりです。</Trans></li>
        </ol>
      ) : (
        <p className="rounded-[1.75rem] bg-surface p-4 text-lg leading-8">
          <Trans>ブラウザのメニュー（⋮ や ⋯）から、「ホーム画面に追加」または「アプリをインストール」をえらびます。</Trans>
        </p>
      )}
    </>
  );
}
