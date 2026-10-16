"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { logOut } from "@/lib/auth-client";
import { CloseIcon, MenuIcon, UserIcon } from "./icons";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SampleNoticeButton } from "./SampleNotice";
import { ThemeSwitcher } from "./ThemeSwitcher";

const barButton =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-ink bg-paper px-2.5 text-base font-bold text-ink hover:bg-surface [&>svg]:size-5";
const wideButton =
  "tap-target flex w-full items-center justify-center rounded-xl px-5 text-lg font-bold";

/**
 * The top bar: one menu button on the left, the data-notice button on the right. The menu holds
 * everything that used to crowd the bar (theme, language, sign in or the profile) and opens as a
 * panel dropping down from the top. While it is open the notice button is hidden.
 */
export function SiteHeader({
  signedIn,
  name,
  sample,
  devTools,
}: {
  signedIn: boolean;
  name: string | null;
  sample: boolean;
  /** Development only: shows the developer links (the map style page). */
  devTools: boolean;
}) {
  const { t, i18n } = useLingui();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  // Going to another page closes the menu. (State adjusted while rendering, the pattern React
  // recommends for resetting state on a prop change; an effect would flash the old state.)
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  const [leaving, setLeaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes it and puts focus back on the button; focus moves into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // After signing in the visitor comes back to where they were (login and register pages excepted).
  const here = /\/(login|register)(\/|$)/.test(pathname) ? "" : `?next=${encodeURIComponent(pathname)}`;
  const loginHref = `/${i18n.locale}/login${here}`;
  const registerHref = `/${i18n.locale}/register${here}`;

  async function signOut() {
    setLeaving(true);
    await logOut();
    setLeaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <header className="relative z-30">
      {open ? (
        // Tapping outside the panel closes it. (Escape and the button do the same for the keyboard.)
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50" />
      ) : null}
      <div className="relative mx-auto flex max-w-xl items-center justify-between gap-2 px-3 py-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="site-menu"
          className={barButton}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
          {open ? t`閉じる` : t`メニュー`}
        </button>
        {sample && !open ? <SampleNoticeButton /> : null}
      </div>

      {open ? (
        <div
          ref={panelRef}
          id="site-menu"
          className="menu-drop absolute inset-x-0 top-full border-b-2 border-brand bg-surface shadow-lg"
        >
          <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5">
            {signedIn ? (
              <div className="flex flex-col gap-3">
                <Link
                  href={`/${i18n.locale}/stamps`}
                  className="tap-target flex items-center gap-3 rounded-xl border-2 border-brand bg-paper px-4 text-xl font-bold hover:bg-surface"
                >
                  <UserIcon />
                  <span className="min-w-0 flex-1 break-words">{name ?? t`ログイン中`}</span>
                  <span className="shrink-0 text-lg text-muted">{t`プロフィールとスタンプ`}</span>
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={leaving}
                  className={`${wideButton} border-2 border-ink bg-paper text-ink hover:bg-surface disabled:opacity-60`}
                >
                  {t`ログアウト`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link href={loginHref} className={`${wideButton} bg-brand text-on-brand`}>
                  {t`ログイン`}
                </Link>
                <Link href={registerHref} className={`${wideButton} border-2 border-ink text-ink hover:bg-surface`}>
                  {t`新規登録`}
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
              <p className="text-lg font-bold">{t`画面の明るさ`}</p>
              <div>
                <ThemeSwitcher />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-lg font-bold">{t`言語`}</p>
              <LocaleSwitcher />
            </div>
            <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
              <Link
                href={`/${i18n.locale}/settings`}
                className="tap-target flex items-center rounded-xl border-2 border-ink px-4 text-lg font-bold text-ink hover:bg-paper"
              >
                {t`見やすさの設定`}
              </Link>
              <p className="text-base text-muted">{t`文字やボタンの大きさ、地図の見せ方`}</p>
            </div>
            {devTools ? (
              <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
                <p className="text-lg font-bold">{t`開発用`}</p>
                <Link
                  href={`/${i18n.locale}/settings/map`}
                  className="tap-target flex items-center rounded-xl border-2 border-ink px-4 text-lg font-bold text-ink hover:bg-paper"
                >
                  {t`地図の見た目の設定`}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
