"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { BellIcon, ClockIcon, DocumentIcon, FlagIcon, GearIcon, ImageIcon, PinIcon, RouteIcon, ShopIcon, StampIcon, UserIcon, WarningIcon } from "@/components/icons";

/** The picture beside each list in the menu; a list the app does not know yet gets a plain document. */
const LIST_ICONS: Record<string, ReactNode> = {
  notices: <BellIcon />,
  banners: <ImageIcon />,
  directory: <ShopIcon />,
  places: <PinIcon />,
  stamps: <StampIcon />,
  users: <UserIcon />,
  audit: <ClockIcon />,
};

// The side menu of the admin area. The screens that exist are links (the generic lists come from the API, see
// lib/admin/lists); the others are listed so the editors can see what is coming, and are not links yet. On a narrow
// screen the list folds behind a button, so it does not push the page down.
export function AdminNav({ lists, isAdmin }: { lists: { key: string; title: string }[]; isAdmin: boolean }) {
  const { t } = useLingui();
  const pathname = usePathname() ?? "";
  const base = "/admin";
  const [open, setOpen] = useState(false);

  const ready = [
    { key: "routes", href: `${base}/routes`, label: t`ルート`, icon: <RouteIcon /> },
    { key: "rallies", href: `${base}/rallies`, label: t`ラリー`, icon: <FlagIcon /> },
    { key: "attention", href: `${base}/attention`, label: t`直すところ`, icon: <WarningIcon /> },
    ...lists.map((l) => ({ key: l.key, href: `${base}/${l.key}`, label: l.title, icon: LIST_ICONS[l.key] ?? <DocumentIcon /> })),
    { key: "pages", href: `${base}/pages`, label: t`ページの文章`, icon: <DocumentIcon /> },
    // The site settings are for an admin only (the API refuses an editor).
    ...(isAdmin ? [{ key: "settings", href: `${base}/settings`, label: t`サイト全体の設定`, icon: <GearIcon /> }] : []),
  ];
  // Menu sections, split by a line. A list the app does not know yet joins the section of notices and banners.
  const SECTIONS = [["routes", "rallies", "places", "directory"], ["attention"], ["notices", "banners", "furigana", "pages"], ["stamps", "users", "audit"], ["settings"]];
  const known = new Set(SECTIONS.flat());
  const sections = SECTIONS.map((keys, i) => [...keys.flatMap((k) => ready.filter((r) => r.key === k)), ...(i === 2 ? ready.filter((r) => !known.has(r.key)) : [])]).filter((g) => g.length > 0);

  return (
    <nav aria-label={t`管理メニュー`} className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-menu"
        onClick={() => setOpen((v) => !v)}
        className="tap-target flex items-center justify-between rounded-xl border-2 border-line px-4 text-lg font-bold lg:hidden"
      >
        {t`メニュー`}
        <span aria-hidden="true">{open ? "−" : "＋"}</span>
      </button>
      <div id="admin-menu" className={`${open ? "flex" : "hidden"} flex-col gap-1 lg:flex`}>
        {sections.map((group, i) => (
          <div key={i} className={`flex flex-col gap-1 ${i > 0 ? "mt-2 border-t border-line pt-3" : ""}`}>
            {group.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`tap-target flex items-center gap-3 rounded-xl px-4 text-lg font-bold ${active ? "bg-brand text-on-brand" : "text-ink hover:bg-surface"}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
