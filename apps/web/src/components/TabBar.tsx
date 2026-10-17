"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { localePath } from "@/lib/rally";
import { HomeIcon, MenuIcon, RouteIcon, StampIcon } from "./icons";
import { useMenu } from "./MenuProvider";

// Tabs with an icon plus a word. On a phone: a floating rounded bar near the bottom, where the thumb is, with
// the active tab as a filled pill. On a wide screen it becomes the left rail, and the menu (a pill at the top
// of the page on a phone) is one more item at the bottom of the rail, so it looks and works like the tabs.
export function TabBar() {
  const { t, i18n } = useLingui();
  const pathname = usePathname() ?? "";
  const { open, setOpen } = useMenu();

  const tabs = [
    { path: "", label: t`ホーム`, icon: <HomeIcon /> },
    { path: "/routes", label: t`ルート`, icon: <RouteIcon /> },
    { path: "/stamps", label: t`スタンプ`, icon: <StampIcon /> },
  ];

  const item =
    "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-full text-sm font-bold leading-tight [&_svg]:size-6 md:min-h-14 md:flex-row md:justify-start md:gap-4 md:rounded-2xl md:px-5 md:text-xl";

  return (
    <nav
      aria-label={t`メインメニュー`}
      className="fixed inset-x-3 bottom-3 z-10 mb-[env(safe-area-inset-bottom)] rounded-full bg-surface p-1.5 shadow-lg md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:mb-0 md:h-dvh md:w-44 md:shrink-0 md:self-start md:rounded-none md:bg-transparent md:p-0 md:px-2 md:pt-6 md:shadow-none lg:w-60"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3 gap-1 md:flex md:max-w-none md:flex-col md:gap-2">
        {tabs.map(({ path, label, icon }) => {
          const href = localePath(i18n.locale, path);
          const active = path === "" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={path}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${item} ${active ? "bg-brand text-on-brand" : "text-ink hover:bg-paper"}`}
              >
                {icon}
                {label}
              </Link>
            </li>
          );
        })}
        <li className="hidden md:block">
          <button
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
  );
}
