"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";

// The side menu of the admin area. The screens that exist are links (the generic lists come from the API, see
// lib/admin/lists); the others are listed so the editors can see what is coming, and are not links yet. On a narrow
// screen the list folds behind a button, so it does not push the page down.
export function AdminNav({ lists }: { lists: { key: string; title: string }[] }) {
  const { t } = useLingui();
  const pathname = usePathname() ?? "";
  const base = "/admin";
  const [open, setOpen] = useState(false);

  const ready = [
    { href: `${base}/routes`, label: t`ルート` },
    { href: `${base}/rallies`, label: t`ラリー` },
    ...lists.map((l) => ({ href: `${base}/${l.key}`, label: l.title })),
    { href: `${base}/settings`, label: t`サイト全体の設定` },
  ];
  const later = [t`ページの文章`];

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
        {ready.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`tap-target flex items-center rounded-xl px-4 text-lg font-bold ${active ? "bg-brand text-on-brand" : "text-ink hover:bg-surface"}`}
            >
              {item.label}
            </Link>
          );
        })}
        <p className="mt-4 px-4 text-base font-bold text-muted">{t`これから追加します`}</p>
        <ul className="flex flex-col gap-1">
          {later.map((label) => (
            <li key={label} className="tap-target flex items-center justify-between rounded-xl px-4 text-lg text-muted">
              <span>{label}</span>
              <span className="text-base">{t`準備中`}</span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
