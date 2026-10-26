"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";

const SNOOZE_KEY = "ktrg-guest-nag-until";
const SEEN_KEY = "ktrg-guest-nag-seen";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const read = (store: Storage, key: string) => {
  try {
    return store.getItem(key);
  } catch {
    return null; // storage blocked: the reminder simply follows the page, with no memory
  }
};
const write = (store: Storage, key: string, value: string) => {
  try {
    store.setItem(key, value);
  } catch {
    // blocked or full: nothing to remember it with
  }
};

/**
 * For a visitor with no account who holds stamps: "your record may be lost, sign up". It opens a moment after each new stamp
 * and once at the start of a visit, never on the sign-up pages, and not for 7 days after "don't show for 7 days".
 */
export function GuestNag({ hasStamps }: { hasStamps: boolean }) {
  const { t } = useLingui();
  const pathname = usePathname() ?? "/";
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const quiet = /^\/(login|register|welcome)(\/|$)/.test(pathname);

  const timer = useRef<number | undefined>(undefined);
  // After the "stamp collected" message has had a moment on screen. The page refreshes meanwhile, so the timer outlives the effects.
  const show = useCallback(() => {
    if (Number(read(localStorage, SNOOZE_KEY) ?? 0) > Date.now()) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (quiet) return;
    window.addEventListener("ktrg:stamped", show);
    return () => window.removeEventListener("ktrg:stamped", show);
  }, [quiet, show]);

  useEffect(() => {
    if (quiet || !hasStamps || read(sessionStorage, SEEN_KEY)) return;
    write(sessionStorage, SEEN_KEY, "1");
    show();
  }, [hasStamps, quiet, show]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const later = "tap-target flex w-full items-center justify-center rounded-xl border border-ink px-4 text-lg font-bold hover:bg-surface";
  return (
    <dialog ref={dialog} aria-labelledby="guest-nag-title" onClose={() => setOpen(false)} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60">
      <h2 id="guest-nag-title" className="text-2xl font-bold leading-snug">
        {t`今すぐアカウントを作りましょう。記録が消えてしまうかもしれません！`}
      </h2>
      <p className="mt-3 text-lg leading-8">{t`いまのスタンプは、このブラウザにしか残っていません。ブラウザのデータを消したり、スマホを変えたりすると、なくなります。登録すると、ずっと残り、コンプリート証ももらえます。`}</p>
      <div className="mt-5 flex flex-col gap-3">
        <Link href="/register" className="tap-target flex items-center justify-center rounded-xl bg-ink px-4 text-xl font-bold text-paper">
          {t`新規登録`}
        </Link>
        <Link href="/login" className={later}>
          {t`ログイン`}
        </Link>
        <button type="button" className={later} onClick={() => setOpen(false)}>
          {t`あとで`}
        </button>
        <button
          type="button"
          className="tap-target text-lg font-bold text-muted underline"
          onClick={() => {
            write(localStorage, SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
            setOpen(false);
          }}
        >
          {t`7日間は表示しない`}
        </button>
      </div>
    </dialog>
  );
}
