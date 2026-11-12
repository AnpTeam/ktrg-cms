"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { HomeIcon, MapIcon, MenuIcon, PanelIcon, RouteIcon, StampIcon } from "./icons";
import { KatsuragiLogo } from "./KatsuragiLogo";
import { LOW_QUERY, watchQuery } from "@/lib/screen";
import { useMenu } from "./MenuProvider";
import { initialBars, nextBars } from "@/lib/scroll-bars";

const subscribeLow = (onChange: () => void) => watchQuery(LOW_QUERY, onChange);

// The sidebar folded to a narrow rail: remembered on this device, and still works where the browser keeps nothing.
const FOLD_KEY = "sidebar-folded";
const foldListeners = new Set<() => void>();
let folded: boolean | null = null;
function isFolded() {
  if (folded === null) {
    try {
      folded = localStorage.getItem(FOLD_KEY) === "1";
    } catch {
      folded = false;
    }
  }
  return folded;
}
function setFolded(on: boolean) {
  folded = on;
  try {
    localStorage.setItem(FOLD_KEY, on ? "1" : "0");
  } catch {
    // Kept for this visit only.
  }
  foldListeners.forEach((l) => l());
}
function subscribeFold(listener: () => void) {
  foldListeners.add(listener);
  return () => foldListeners.delete(listener);
}

// Tabs with an icon plus a word. On a phone: a floating rounded bar near the bottom, where the thumb is, with
// the active tab as a filled pill. On a wide screen it becomes the left rail, and the menu (a pill at the top
// of the page on a phone) is one more item at the bottom of the rail, so it looks and works like the tabs.
// From 1024 px it is a sidebar fixed to the far left: the logo (a link home), the tabs and, at the bottom, `footer`
// (the site's footer links), so they are always in view. On a phone and a tablet only the tabs are shown.
export function TabBar({ footer }: { footer?: ReactNode }) {
  const { t } = useLingui();
  const pathname = usePathname() ?? "";
  const { open, setOpen, railButton } = useMenu();
  const foldedByHand = useSyncExternalStore(subscribeFold, isFolded, () => false);
  // A phone on its side has no width to spare: the menu stays folded, and there is no button to open it.
  const low = useSyncExternalStore(subscribeLow, () => window.matchMedia(LOW_QUERY).matches, () => false);
  const mini = foldedByHand || low;

  // While reading on a phone, scrolling down tucks the tab bar away and scrolling up brings it
  // back (lib/scroll-bars.ts). It only sets <html data-bars="hidden">; the CSS decides who moves (phones only). A new page
  // and an open menu always show them.
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      delete root.dataset.bars;
      return;
    }
    let state = initialBars(window.scrollY);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        state = nextBars(state, window.scrollY, document.documentElement.scrollHeight - window.innerHeight);
        if (state.hidden) root.dataset.bars = "hidden";
        else delete root.dataset.bars;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      delete root.dataset.bars;
    };
  }, [open, pathname]);

  const tabs = [
    { path: "/", label: t`ホーム`, icon: <HomeIcon /> },
    { path: "/map", label: t`マップ`, icon: <MapIcon /> },
    { path: "/routes", label: t`ルート`, icon: <RouteIcon /> },
    { path: "/rallies", label: t`ラリー`, icon: <StampIcon /> },
  ];

  // The label is capped at 4.25vw so "Routes" still fits a 320 px phone at the largest text size; wider screens never hit the cap.
  const item =
    "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.125rem] text-[min(0.875rem,4.25vw)] font-bold leading-tight [&_svg]:size-6 md:min-h-14 md:flex-row md:justify-start md:gap-4 md:rounded-full md:px-5 md:text-xl";
  // Folded, a tab is its icon over its word again, as on a phone.
  const miniItem = mini ? ` wide:flex-col wide:justify-center wide:gap-0.5 wide:rounded-[1.125rem] wide:px-0 wide:text-sm ${low ? "wide:min-h-12" : ""}` : "";

  return (
    // Below 1024 px this wrapper adds nothing (the nav is placed by its own classes); from 1024 px it is the sidebar.
    <div data-rail={mini ? "mini" : "full"} className={`print:hidden md:contents wide:sticky wide:top-0 wide:flex wide:h-dvh wide:shrink-0 wide:flex-col wide:self-start wide:overflow-y-auto wide:border-r wide:border-surface ${mini ? "wide:w-20" : "wide:w-64"}`}>
    <Link href="/" aria-label={t`ホーム`} className={`hidden wide:block ${low ? "px-2 pt-2" : mini ? "px-2 pt-4" : "px-6 pb-2 pt-8"}`}>
      <KatsuragiLogo compact className={mini ? "mx-auto h-8 w-auto" : "h-16 w-auto"} />
    </Link>
    {low ? null : (
    <button
      type="button"
      onClick={() => setFolded(!mini)}
      aria-expanded={!mini}
      aria-label={mini ? t`メニューをひらく` : t`メニューをたたむ`}
      title={mini ? t`メニューをひらく` : t`メニューをたたむ`}
      className={`tap-target hidden items-center justify-center rounded-full text-ink hover:bg-surface wide:inline-flex ${mini ? "mx-auto mt-2 shrink-0" : "absolute right-2 top-2"}`}
    >
      <PanelIcon />
    </button>
    )}
    <nav
      aria-label={t`メインメニュー`}
      data-tabbar
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line/30 bg-paper px-1 pb-[calc(0.375rem+env(safe-area-inset-bottom))] min-[400px]:px-3 pt-1.5 md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:h-dvh md:w-44 md:shrink-0 md:self-start md:border-t-0 md:bg-transparent md:p-0 md:px-2 md:pt-6 wide:static wide:h-auto wide:w-full wide:flex-1 wide:self-auto ${low ? "wide:pt-1" : "wide:pt-4"} ${mini ? "wide:px-2" : "wide:px-4"}`}
    >
      <ul className={`mx-auto grid max-w-xl grid-cols-5 gap-0.5 min-[400px]:gap-1 md:flex md:max-w-none md:flex-col ${low ? "md:gap-0.5" : "md:gap-2"}`}>
        {tabs.map(({ path, label, icon }) => {
          const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
          return (
            <li key={path}>
              <Link
                href={path}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  // With the menu open, the first tap on the tab you are in only closes it (you stay on this page); a second tap goes to the tab's own page.
                  if (open && active) e.preventDefault();
                  setOpen(false);
                }}
                className={`${item}${miniItem} ${active && !open ? "bg-selected text-on-selected" : "text-ink hover:bg-paper"}`}
              >
                {icon}
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            ref={railButton}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="site-menu"
            className={`${item}${miniItem} w-full ${open ? "bg-ink text-paper" : "text-ink hover:bg-paper"}`}
          >
            <MenuIcon />
            {t`メニュー`}
          </button>
        </li>
      </ul>
    </nav>
    {footer && !mini ? <div className="hidden px-4 pb-4 wide:block">{footer}</div> : null}
    </div>
  );
}
