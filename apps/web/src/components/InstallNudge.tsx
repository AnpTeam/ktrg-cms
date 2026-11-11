"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { InstallSteps } from "@/components/InstallSteps";
import { isInAppBrowser } from "@/lib/browser-check";
import { installNudgeShows } from "@/lib/landing-story";

// Cookies, not storage: a visit counter (a year), a marker for "this visit was counted" (the session) and the day the bar
// was dismissed. Nothing here identifies anyone.
const VISITS = "visits";
const COUNTED = "visit-counted";
const DISMISSED = "install-nudge";
const DAY_MS = 86_400_000;

const readCookie = (name: string): string | null => {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};
const writeCookie = (name: string, value: string, maxAge?: number) => {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${maxAge ? `; Max-Age=${maxAge}` : ""}${secure}`;
};

/**
 * The small "add to home screen" bar (docs/landing-story-design.md): on a phone that has not installed the app, from the
 * second visit or after three minutes, never on the map, over a dialog or while someone types; dismissing it hides it for
 * 30 days. It replaces the install step of the old intro screen, which asked before the visitor had seen anything.
 */
export function InstallNudge() {
  const { t } = useLingui();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const started = useRef(0); // set on mount: Date.now() is not for render
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    started.current = Date.now();
    // Count this visit once per browser session.
    if (!readCookie(COUNTED)) {
      writeCookie(VISITS, String((Number(readCookie(VISITS)) || 0) + 1), 31_536_000);
      writeCookie(COUNTED, "1");
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const dismissedAt = Number(readCookie(DISMISSED));
      const typing = document.activeElement?.closest("input, textarea, select, [contenteditable='true']") != null;
      setShow(
        installNudgeShows({
          phone: window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 768,
          installed: window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
          inAppBrowser: isInAppBrowser(navigator.userAgent),
          onMap: /^\/map\/?$/.test(pathname),
          visits: Number(readCookie(VISITS)) || 0,
          seconds: (Date.now() - started.current) / 1000,
          dismissedDaysAgo: dismissedAt > 0 ? (Date.now() - dismissedAt) / DAY_MS : null,
          dialogOpen: document.querySelector("dialog[open]") !== null,
          inputFocused: typing,
        }),
      );
    };
    check();
    const timer = window.setInterval(check, 2000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  const dismiss = () => {
    writeCookie(DISMISSED, String(Date.now()), 31_536_000);
    setShow(false);
  };

  return (
    <>
      {show ? (
        <div role="region" aria-label={t`ホーム画面に追加`} className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 shadow-2xl ring-1 ring-line/30 md:hidden">
          <p className="min-w-0 flex-1 text-base font-bold leading-snug">
            <Trans>ホーム画面に追加しましょう</Trans>
          </p>
          <button type="button" onClick={() => dialog.current?.showModal()} className="tap-target shrink-0 rounded-full bg-brand px-4 text-base font-bold text-on-brand">
            <Trans>追加のしかた</Trans>
          </button>
          <button type="button" onClick={dismiss} aria-label={t`あとで`} className="tap-target shrink-0 rounded-full px-3 text-base font-bold text-muted underline">
            <Trans>あとで</Trans>
          </button>
        </div>
      ) : null}
      <dialog ref={dialog} aria-labelledby="install-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-paper p-5 text-ink backdrop:bg-black/60">
        <div className="flex flex-col gap-4">
          <InstallSteps titleId="install-title" />
          <button type="button" onClick={() => dialog.current?.close()} className="tap-target flex min-h-12 w-full items-center justify-center rounded-full border-2 border-ink px-6 text-lg font-bold">
            <Trans>閉じる</Trans>
          </button>
        </div>
      </dialog>
    </>
  );
}
