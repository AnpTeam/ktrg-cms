"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { localePath } from "@/lib/rally";
import { HomeIcon, RouteIcon, StampIcon } from "./icons";

// Three tabs, icon plus word, at the bottom where the thumb is. No menu to open.
export function TabBar() {
  const { t, i18n } = useLingui();
  const pathname = usePathname() ?? "";

  const tabs = [
    { path: "", label: t`ホーム`, icon: <HomeIcon /> },
    { path: "/routes", label: t`ルート`, icon: <RouteIcon /> },
    { path: "/stamps", label: t`スタンプ`, icon: <StampIcon /> },
  ];

  return (
    <nav
      aria-label={t`メインメニュー`}
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {tabs.map(({ path, label, icon }) => {
          const href = localePath(i18n.locale, path);
          const active = path === "" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={path}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`tap-target flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-base font-bold ${
                  active ? "bg-accent text-paper" : "text-ink hover:bg-surface"
                }`}
              >
                {icon}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
