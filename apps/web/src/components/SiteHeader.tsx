"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { logOut } from "@/lib/auth-client";
import { ChevronIcon, CloseIcon, MenuIcon, UserIcon } from "./icons";
import { KatsuragiLogo } from "./KatsuragiLogo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useMenu } from "./MenuProvider";
import { SampleNoticeButton } from "./SampleNotice";
import { ThemeSwitcher } from "./ThemeSwitcher";

const barButton =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-ink bg-paper px-2.5 text-base font-bold text-ink hover:bg-surface [&>svg]:size-5";
// How far the signed-out home page is scrolled (in px) before its menu button appears.
const SHOW_MENU_AFTER = 240;
const wideButton =
  "tap-target flex w-full items-center justify-center rounded-xl px-5 text-lg font-bold";

/**
 * The top bar: one menu button on the left, the data-notice button on the right. The menu holds
 * everything that used to crowd the bar (theme, language, sign in or the profile) and opens as a
 * panel dropping down from the top. While it is open the notice button is hidden.
 *
 * On the home page for someone who is signed out the bar takes no room and stays out of sight at first, so the
 * banner and the title get the whole top of the screen (the register and login buttons are right there). It
 * fades in once the visitor has scrolled a little, floating over the page. It never appears on a timer: a
 * button that shows up by itself moves under the finger. On the map page the bar floats over the map, always.
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
  const { open, setOpen } = useMenu();
  const [leaving, setLeaving] = useState(false);
  const onMap = /^\/(ja|en)\/map\/?$/.test(pathname);
  const onLanding = onMap || (!signedIn && /^\/(ja|en)\/?$/.test(pathname));
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!onLanding || onMap) return;
    const onScroll = () => setScrolled(window.scrollY > SHOW_MENU_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onLanding, onMap]);
  const hidden = onLanding && !onMap && !scrolled && !open;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // While the menu is open the page behind it must not scroll: only the menu does.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
  }, [open, setOpen]);

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
    <header className={onLanding ? "sticky top-0 z-30 h-0" : "relative z-30 md:sticky md:top-0 md:h-0"}>
      {open ? (
        // Tapping outside the panel closes it. (Escape and the button do the same for the keyboard.)
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50" />
      ) : null}
      <div
        inert={hidden}
        className={
          onMap
            ? "pointer-events-none absolute inset-x-0 top-0 mx-auto flex max-w-xl items-center justify-between gap-2 px-3 py-3 md:hidden [&>*]:pointer-events-auto"
            : onLanding
              ? `absolute inset-x-0 top-0 mx-auto flex max-w-xl md:hidden items-center justify-between gap-2 bg-paper/95 px-3 py-2 transition-opacity motion-reduce:transition-none ${
                  hidden ? "pointer-events-none opacity-0" : ""
                }`
              : "relative mx-auto flex max-w-xl items-center justify-between gap-2 px-3 pb-5 pt-3 md:hidden"
        }
      >
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
        {/* The logo is a link home. The landing page has it in its title card and the map has no room for it. */}
        {!onLanding && !open ? (
          <Link href={`/${i18n.locale}`} aria-label={t`ホーム`} className="rounded-lg p-1">
            <KatsuragiLogo compact className="h-10 w-auto" />
          </Link>
        ) : null}
        {sample && !open ? <SampleNoticeButton /> : null}
      </div>

      {open ? (
        <div
          ref={panelRef}
          id="site-menu"
          className={`menu-drop absolute inset-x-0 overflow-y-auto overscroll-contain border-b-2 border-brand bg-surface shadow-lg md:top-0 md:max-h-dvh md:rounded-b-3xl ${onLanding ? "top-14 max-h-[calc(100dvh-3.5rem)]" : "top-full max-h-[calc(100dvh-3.5rem)]"}`}
        >
          <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tap-target hidden items-center gap-2 self-end rounded-lg border-2 border-ink px-3 text-lg font-bold md:inline-flex"
            >
              <CloseIcon />
              {t`閉じる`}
            </button>
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
            <ul className="flex flex-col border-t-2 border-line pt-2">
              {[
                { path: "/faq", label: t`よくあるご質問` },
                { path: "/terms", label: t`利用規約` },
                { path: "/privacy", label: t`プライバシーポリシー` },
                { path: "/licenses", label: t`ライセンス情報` },
              ].map(({ path, label }) => (
                <li key={path}>
                  <Link href={`/${i18n.locale}${path}`} className="tap-target flex items-center justify-between py-1 text-lg font-bold">
                    {label}
                    <ChevronIcon />
                  </Link>
                </li>
              ))}
            </ul>
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
