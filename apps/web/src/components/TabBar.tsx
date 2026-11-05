"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { HomeIcon, MapIcon, MenuIcon, RouteIcon, StampIcon } from "./icons";
import { KatsuragiLogo } from "./KatsuragiLogo";
import { useMenu } from "./MenuProvider";

// Tabs with an icon plus a word. On a phone: a floating rounded bar near the bottom, where the thumb is, with
// the active tab as a filled pill. On a wide screen it becomes the left rail, and the menu (a pill at the top
// of the page on a phone) is one more item at the bottom of the rail, so it looks and works like the tabs.
// From 1024 px it is a sidebar fixed to the far left: the logo (a link home), the tabs and, at the bottom, `footer`
// (the site's footer links), so they are always in view. On a phone and a tablet only the tabs are shown.
export function TabBar({ footer }: { footer?: ReactNode }) {
  const { t } = useLingui();
  const pathname = usePathname() ?? "";
  const { open, setOpen, railButton } = useMenu();

  const tabs = [
    { path: "/", label: t`ホーム`, icon: <HomeIcon /> },
    { path: "/map", label: t`マップ`, icon: <MapIcon /> },
    { path: "/routes", label: t`ルート`, icon: <RouteIcon /> },
    { path: "/rallies", label: t`ラリー`, icon: <StampIcon /> },
  ];

  // The label is capped at 4.25vw so "Routes" still fits a 320 px phone at the largest text size; wider screens never hit the cap.
  const item =
    "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[min(0.875rem,4.25vw)] font-bold leading-tight [&_svg]:size-6 md:min-h-14 md:flex-row md:justify-start md:gap-4 md:rounded-2xl md:px-5 md:text-xl";

  return (
    // Below 1024 px this wrapper adds nothing (the nav is placed by its own classes); from 1024 px it is the sidebar.
    <div className="print:hidden md:contents lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-y-auto lg:border-r lg:border-surface">
    <Link href="/" aria-label={t`ホーム`} className="sidebar-logo hidden px-6 pb-2 pt-8 lg:block">
      <KatsuragiLogo compact className="h-16 w-auto" />
    </Link>
    <nav
      aria-label={t`メインメニュー`}
      data-tabbar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/30 bg-paper px-1 pb-[calc(0.375rem+env(safe-area-inset-bottom))] min-[400px]:px-3 pt-1.5 md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:h-dvh md:w-44 md:shrink-0 md:self-start md:border-t-0 md:bg-transparent md:p-0 md:px-2 md:pt-6 lg:static lg:h-auto lg:w-full lg:flex-1 lg:self-auto lg:px-4 lg:pt-4"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 gap-0.5 min-[400px]:gap-1 md:flex md:max-w-none md:flex-col md:gap-2">
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
                className={`${item} ${active && !open ? "bg-brand text-on-brand" : "text-ink hover:bg-paper"}`}
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
            className={`${item} w-full ${open ? "bg-ink text-paper" : "text-ink hover:bg-paper"}`}
          >
            <MenuIcon />
            {t`メニュー`}
          </button>
        </li>
      </ul>
    </nav>
    {footer ? <div className="hidden px-4 pb-4 lg:block">{footer}</div> : null}
    </div>
  );
}
