"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { logOut } from "@/lib/auth-client";
import { ChevronIcon, CloseIcon, MenuIcon, UserIcon } from "./icons";
import { KatsuragiLogo } from "./KatsuragiLogo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useMenu } from "./MenuProvider";
import { SampleNoticeButton } from "./SampleNotice";
import { ThemeSwitcher } from "./ThemeSwitcher";

const barButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-ink bg-paper px-2.5 text-base font-bold text-ink hover:bg-surface [&>svg]:size-6";
// How far the signed-out home page is scrolled (in px) before its menu button appears.
const SHOW_MENU_AFTER = 240;
const wideButton =
  "tap-target flex w-full items-center justify-center rounded-xl px-5 text-lg font-bold";

/**
 * The top bar: one menu button on the left, the data-notice button on the right. The menu holds
 * everything that used to crowd the bar (theme, language, sign in or the profile). On a phone it opens as a
 * panel dropping down from the top; from 768 px it is a popover beside the rail's menu button. While it is open
 * the notice button is hidden.
 *
 * On the home page for someone who is signed out the bar takes no room and stays out of sight at first, so the
 * banner and the title get the whole top of the screen (the register and login buttons are right there). It
 * fades in once the visitor has scrolled a little, floating over the page. It never appears on a timer: a
 * button that shows up by itself moves under the finger. On the map page the bar floats over the map, always, with no
 * background of its own: just the menu button, the logo and the notice button, so the map has the whole screen.
 */
export function SiteHeader({
  signedIn,
  name,
  sample,
}: {
  signedIn: boolean;
  name: string | null;
  sample: boolean;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { open, setOpen, railButton } = useMenu();
  const [leaving, setLeaving] = useState(false);
  const onMap = /^\/map\/?$/.test(pathname);
  const onLanding = onMap || (!signedIn && pathname === "/");
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

  // 768 px and up: the menu is a popover beside the rail button, and the page behind it may scroll.
  const wide = () => window.matchMedia("(min-width: 768px)").matches;

  // The popover sits to the right of the rail button that opened it, as high as the button allows while staying fully
  // on screen, and grows out of the button. A resize would leave it in the wrong place, so it closes instead.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = railButton.current;
    if (!open || !panel || !anchor || !wide()) return;
    const r = anchor.getBoundingClientRect();
    const top = Math.max(12, Math.min(r.top - 8, window.innerHeight - panel.offsetHeight - 12));
    panel.style.left = `${r.right + 12}px`;
    panel.style.top = `${top}px`;
    panel.style.transformOrigin = `left ${r.top + r.height / 2 - top}px`;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open, railButton, setOpen]);

  // While the menu is open on a phone the page behind it must not scroll: only the menu does.
  useEffect(() => {
    if (!open || wide()) return;
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
      (wide() ? railButton.current : buttonRef.current)?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen, railButton]);

  // After signing in the visitor comes back to where they were (login and register pages excepted).
  const here = /\/(login|register)(\/|$)/.test(pathname) ? "" : `?next=${encodeURIComponent(pathname)}`;
  const loginHref = `/login${here}`;
  const registerHref = `/register${here}`;

  async function signOut() {
    setLeaving(true);
    await logOut();
    setLeaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <header className={`site-header ${onLanding ? "sticky top-0 z-30 h-0" : "relative z-30 md:sticky md:top-0 md:h-0"}`}>
      {open ? (
        // Tapping outside the panel closes it. (Escape and the button do the same for the keyboard.)
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 md:bg-transparent" />
      ) : null}
      <div
        inert={hidden}
        // The bar is as wide as the tab bar at the bottom (same side gaps), with the logo in the middle.
        className={
          onMap
            ? "pointer-events-none absolute inset-x-3 top-3 md:hidden [&>*]:pointer-events-auto"
            : onLanding
              ? `absolute inset-x-3 top-3 transition-opacity md:hidden motion-reduce:transition-none ${hidden ? "pointer-events-none opacity-0" : ""}`
              : "relative px-3 pb-5 pt-3 md:hidden"
        }
      >
        <div className={`mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 ${onMap ? "" : "rounded-xl bg-surface p-1.5 shadow-lg"}`}>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? t`閉じる` : t`メニュー`}
            className={`${barButton} min-w-12 justify-center justify-self-start ${onMap ? "shadow-md" : ""}`}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
          {/* The logo is a link home. It is drawn in the page (inline SVG, not an image), so there is nothing to long-press and
              save. On the map the bar has no background, so the logo gets a halo in the page colour to stay readable. */}
          {!open ? (
            <Link href="/" aria-label={t`ホーム`} className="rounded-lg p-1">
              <KatsuragiLogo compact className={`h-9 w-auto ${onMap ? "[filter:drop-shadow(0_0_1px_var(--color-paper))_drop-shadow(0_0_3px_var(--color-paper))_drop-shadow(0_0_6px_var(--color-paper))]" : ""}`} />
            </Link>
          ) : (
            <span />
          )}
          <span className="justify-self-end">{sample && !open ? <SampleNoticeButton /> : null}</span>
        </div>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id="site-menu"
          className={`menu-drop absolute inset-x-0 overflow-y-auto overscroll-contain border-b-2 border-brand bg-surface shadow-lg md:fixed md:right-auto md:w-[26rem] md:max-h-[calc(100dvh-1.5rem)] md:rounded-2xl md:border-2 md:shadow-xl ${onLanding ? "top-[4.75rem] max-h-[calc(100dvh-4.75rem)]" : "top-full max-h-[calc(100dvh-3.5rem)]"}`}
        >
          <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tap-target hidden items-center gap-2 self-end rounded-lg border border-ink px-3 text-lg font-bold md:inline-flex"
            >
              <CloseIcon />
              {t`閉じる`}
            </button>
            {signedIn ? (
              <div className="flex flex-col gap-3">
                <Link prefetch={false}
                  href="/stamps"
                  className="tap-target flex items-center gap-3 rounded-xl border border-ink bg-paper px-4 text-xl font-bold hover:bg-surface"
                >
                  <UserIcon />
                  <span className="min-w-0 flex-1 break-words">{name ?? t`ログイン中`}</span>
                  <span className="shrink-0 text-lg text-muted">{t`プロフィールとスタンプ`}</span>
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={leaving}
                  className={`${wideButton} border border-ink bg-paper text-ink hover:bg-surface disabled:opacity-60`}
                >
                  {t`ログアウト`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link prefetch={false} href={loginHref} className={`${wideButton} bg-ink text-paper`}>
                  {t`ログイン`}
                </Link>
                <Link prefetch={false} href={registerHref} className={`${wideButton} border border-ink text-ink hover:bg-surface`}>
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
              <Link prefetch={false}
                href="/settings"
                className="tap-target flex items-center rounded-xl border border-ink px-4 text-lg font-bold text-ink hover:bg-paper"
              >
                {t`見やすさの設定`}
              </Link>
              <p className="text-base text-muted">{t`文字やボタンの大きさ、地図の見せ方`}</p>
            </div>
            {/* From 1024 px these links are always in the sidebar's footer, so the menu leaves them out. */}
            <ul className="flex flex-col border-t-2 border-line pt-2 lg:hidden">
              {[
                { path: "/faq", label: t`よくあるご質問` },
                { path: "/terms", label: t`利用規約` },
                { path: "/privacy", label: t`プライバシーポリシー` },
                { path: "/licenses", label: t`ライセンス情報` },
              ].map(({ path, label }) => (
                <li key={path}>
                  <Link prefetch={false} href={path} className="tap-target flex items-center justify-between py-1 text-lg font-bold">
                    {label}
                    <ChevronIcon />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </header>
  );
}
