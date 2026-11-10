"use client";

import { getOutbox } from "@/lib/stamp-outbox";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { logOut } from "@/lib/auth-client";
import { clearSavedPages } from "@/lib/offline-pack";
import { BookmarkIcon, ChevronIcon, DocumentIcon, ChevronLeftIcon, CloseIcon, GearIcon } from "./icons";
import { QuickActions } from "./QuickActions";
import type { Prefs } from "@/lib/prefs";
import { ProfileCard, type ProfileCardProps } from "./ProfileCard";
import { KatsuragiLogo } from "./KatsuragiLogo";
import { LocaleSelect } from "./LocaleSwitcher";
import { foundationEn, foundationJa } from "@/lib/terms-content";
import { useMenu } from "./MenuProvider";
import { SampleNoticeButton } from "./SampleNotice";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { confirmDialog } from "@/components/ConfirmDialog";

const barButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink bg-paper px-2.5 text-base font-bold text-ink hover:bg-surface [&>svg]:size-6";
// How far the signed-out home page is scrolled (in px) before its menu button appears.
const SHOW_MENU_AFTER = 240;
const wideButton =
  "tap-target flex w-full items-center justify-center rounded-full px-5 text-lg font-bold";

// The four tab pages: nothing is "behind" them, so the bar has no back button there.
const TOP_LEVEL = /^\/(map|routes|rallies)?\/?$/;

/** Where "back" goes when this visit has no earlier page of the site to return to (a link opened from outside). */
const parentOf = (pathname: string) => (pathname.startsWith("/routes/") ? "/routes" : pathname.startsWith("/spots/") ? "/map" : "/");

/**
 * The top bar: a back button on the left (where a thumb expects it), the logo in the middle and the data-notice
 * button on the right. The menu is the last item of the tab bar at the bottom; it holds everything that used to
 * crowd the bar (theme, language, sign in or the profile). On a phone it opens as a panel dropping down from the
 * top; from 768 px it is a popover beside the rail's menu button. While it is open the notice button is hidden.
 *
 * On the home page for someone who is signed out the bar takes no room and stays out of sight at first, so the
 * banner and the title get the whole top of the screen (the register and login buttons are right there). It
 * fades in once the visitor has scrolled a little, floating over the page. It never appears on a timer: a
 * button that shows up by itself moves under the finger. On the map page the bar floats over the map, always, with no
 * background of its own: just the menu button, the logo and the notice button, so the map has the whole screen.
 */
export function SiteHeader({
  signedIn,
  staff = false,
  profile,
  locale,
  prefs,
  sample,
}: {
  signedIn: boolean;
  /** An editor or admin: the menu has a link to the admin area (the server still checks the role there). */
  staff?: boolean;
  profile: Omit<ProfileCardProps, "locale">;
  locale: string;
  prefs: Prefs;
  sample: boolean;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { open, setOpen, railButton } = useMenu();
  const [leaving, setLeaving] = useState(false);
  // Whether this visit has moved between pages yet: then "back" is the browser's own, else it goes to the page's parent.
  const moved = useRef(false);
  const first = useRef(pathname);
  useEffect(() => {
    if (pathname !== first.current) moved.current = true;
  }, [pathname]);
  const goBack = () => (moved.current ? router.back() : router.push(parentOf(pathname)));
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
  const panelRef = useRef<HTMLDivElement>(null);

  // 768 px and up: the menu is a popover beside the rail button, and the page behind it may scroll.
  const wide = () => window.matchMedia("(min-width: 768px)").matches;

  // The popover sits to the right of the rail button that opened it, as high as the button allows while staying fully
  // on screen, and grows out of the button. A resize would leave it in the wrong place, so it closes instead.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = railButton.current;
    if (!open || !panel || !anchor || !wide()) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const top = Math.max(12, Math.min(r.top - 8, window.innerHeight - panel.offsetHeight - 12));
      panel.style.left = `${r.right + 12}px`;
      panel.style.top = `${top}px`;
      panel.style.transformOrigin = `left ${r.top + r.height / 2 - top}px`;
    };
    place();
    // The menu fills in after it opens (the account block, the settings), so it is placed again whenever its height changes.
    const watch = new ResizeObserver(place);
    watch.observe(panel);
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", close);
    };
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
      railButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen, railButton]);

  // After signing in the visitor comes back to where they were (login and register pages excepted).
  const here = /\/(login|register)(\/|$)/.test(pathname) ? "" : `?next=${encodeURIComponent(pathname)}`;
  const loginHref = `/login${here}`;
  const registerHref = `/register${here}`;

  async function signOut() {
    // Stamps pressed with no signal stay on this phone under this account; they are sent after the next sign-in.
    const waiting = getOutbox().pending;
    if (waiting > 0 && !(await confirmDialog({ title: t`ログアウトしますか？`, body: t`送信待ちのスタンプが${waiting}件あります。ログアウトすると、次にログインするまで送れません。ログアウトしますか？`, yes: t`ログアウトする` }))) return;
    setLeaving(true);
    await clearSavedPages(); // the saved pages show this person's stamps
    await logOut();
    setLeaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <header className={`print:hidden site-header ${onLanding ? "sticky top-0 z-30 h-0" : "relative z-30 md:sticky md:top-0 md:h-0"}`}>
      {open ? (
        // Tapping outside the panel closes it. (Escape and the button do the same for the keyboard.)
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 md:bg-transparent" />
      ) : null}
      <div
        inert={hidden}
        // The bar is as wide as the tab bar at the bottom (same side gaps), with the logo in the middle.
        className={
          onMap
            ? "pointer-events-none absolute inset-x-3 top-[calc(0.75rem+var(--top-clear))] md:hidden"
            : onLanding
              ? `absolute inset-x-0 top-0 border-b border-line/30 bg-paper px-3 pb-1 pt-[calc(0.25rem+var(--top-clear))] transition-opacity md:hidden motion-reduce:transition-none ${hidden ? "pointer-events-none opacity-0" : ""}`
              : "site-header-bar relative mb-3 border-b border-line/30 bg-paper px-3 py-1 md:hidden"
        }
      >
        <div className={`mx-auto grid max-w-xl items-center gap-2 ${onMap ? "pointer-events-none grid-cols-[auto_1fr_auto] [&>*]:pointer-events-auto" : "grid-cols-[1fr_auto_1fr]"}`}>
          {TOP_LEVEL.test(pathname) ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={goBack}
              aria-label={t`もどる`}
              className={`${barButton} min-w-12 justify-center justify-self-start`}
            >
              <ChevronLeftIcon />
            </button>
          )}
          {/* The logo is a link home. It is drawn in the page (inline SVG, not an image), so there is nothing to long-press and
              save. On the map the bar has no background, so the logo gets a halo in the page colour to stay readable. */}
          {!open ? (
            <Link href="/" aria-label={t`ホーム`} className={`rounded-lg p-1 ${onMap ? "justify-self-start" : ""}`}>
              <KatsuragiLogo compact className={`h-9 w-auto ${onMap ? "[filter:drop-shadow(0_0_1px_var(--color-paper))_drop-shadow(0_0_3px_var(--color-paper))_drop-shadow(0_0_6px_var(--color-paper))]" : ""}`} />
            </Link>
          ) : (
            <span />
          )}
          {/* Open: the language drop-down takes the right end of the bar, so the bar and the menu read as one piece. */}
          <span className="justify-self-end">{open ? <LocaleSelect /> : sample ? <SampleNoticeButton /> : null}</span>
        </div>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id="site-menu"
          // A link to the page we are already on does not change the path, so close here to show the tap worked.
          onClick={(e) => e.target instanceof Element && e.target.closest("a") && setOpen(false)}
          className="menu-drop fixed inset-0 overflow-y-auto overscroll-contain bg-surface pb-28 pt-[var(--top-clear)] md:inset-auto md:right-auto md:w-[26rem] md:max-h-[calc(100dvh-1.5rem)] md:rounded-2xl md:border-2 md:border-brand md:pb-0 md:pt-0 md:shadow-xl"
        >
          <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5">
            {/* From 768 px the bar is not drawn (the rail has the menu button), so the top row of the popover holds both. */}
            <div className="flex items-center justify-between gap-2 md:justify-end">
              <span className="text-2xl font-bold md:hidden">{t`メニュー`}</span>
              {/* On a phone the Menu tab below closes it; the popover has no tab to press. */}
              <button type="button" onClick={() => setOpen(false)} className="tap-target hidden items-center gap-2 rounded-full border border-ink px-3 text-lg font-bold md:inline-flex">
                <CloseIcon />
                {t`閉じる`}
              </button>
            </div>
            {signedIn ? (
              <div className="flex flex-col gap-3">
                {/* Who is signed in, for a glance; changing it is on the profile page (the account settings item below). */}
                <div className="-mx-4">
                  <ProfileCard {...profile} locale={locale} readOnly />
                </div>
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

            {signedIn ? (
              <Link prefetch={false} href="/profile" className="tap-target flex items-center gap-3 rounded-full border border-ink bg-paper px-4 text-xl font-bold hover:bg-surface">
                <GearIcon />
                <span className="min-w-0 flex-1">{t`アカウント設定`}</span>
                <ChevronIcon />
              </Link>
            ) : null}
            {staff ? (
              <Link prefetch={false} href="/admin" className="tap-target flex items-center gap-3 rounded-full border border-ink bg-paper px-4 text-xl font-bold hover:bg-surface">
                <GearIcon />
                <span className="min-w-0 flex-1">{t`管理画面`}</span>
                <ChevronIcon />
              </Link>
            ) : null}
            <Link prefetch={false} href="/bookmarks" className="tap-target flex items-center gap-3 rounded-full border border-ink bg-paper px-4 text-xl font-bold hover:bg-surface">
              <BookmarkIcon />
              <span className="min-w-0 flex-1">{t`ブックマーク`}</span>
              <ChevronIcon />
            </Link>
            <Link prefetch={false} href="/blog" className="tap-target flex items-center gap-3 rounded-full border border-ink bg-paper px-4 text-xl font-bold hover:bg-surface">
              <DocumentIcon />
              <span className="min-w-0 flex-1">{t`ブログ`}</span>
              <ChevronIcon />
            </Link>

            <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
              <p className="text-lg font-bold">{t`画面の明るさ`}</p>
              <div className="flex flex-wrap items-center gap-3">
                <ThemeSwitcher />
                <LocaleSelect />
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
              <Link prefetch={false}
                href="/settings"
                className="tap-target flex items-center rounded-full border border-ink px-4 text-lg font-bold text-ink hover:bg-paper"
              >
                {t`見やすさの設定`}
              </Link>
              <p className="text-base text-muted">{t`文字やボタンの大きさ、地図の見せ方`}</p>
              <QuickActions prefs={prefs} signedIn={signedIn} />
            </div>
            {/* From 1024 px these links are always in the sidebar's footer, so the menu leaves them out. */}
            <ul className="flex flex-col border-t-2 border-line pt-2 wide:hidden">
              {[
                { path: "/places", label: t`お店と施設` },
                { path: "/faq", label: t`よくあるご質問` },
                { path: "/terms", label: t`利用規約` },
                { path: "/privacy", label: t`プライバシーポリシー` },
                { path: "/licenses", label: t`ライセンス情報` },
                { path: "/sitemap", label: t`サイトマップ` },
              ].map(({ path, label }) => (
                <li key={path}>
                  <Link prefetch={false} href={path} className="tap-target flex items-center justify-between py-1 text-lg font-bold">
                    {label}
                    <ChevronIcon />
                  </Link>
                </li>
              ))}
            </ul>
            <p lang={locale === "ja" ? "ja" : "en"} className="text-base text-muted wide:hidden">
              {locale === "ja" ? foundationJa : foundationEn}
            </p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
