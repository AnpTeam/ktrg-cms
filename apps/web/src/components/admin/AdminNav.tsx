"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";

// The side menu of the admin area. Only "ルート" exists in this first version; the other entries are listed so
// the editors can see what is coming, and are not links yet.
export function AdminNav({ locale }: { locale: string }) {
  const { t } = useLingui();
  const pathname = usePathname() ?? "";
  const base = `/${locale}/admin`;

  const ready = [{ href: `${base}/routes`, label: t`ルート` }];
  const later = [t`ラリー`, t`場所の一覧`, t`お知らせ`, t`バナー`, t`ページの文章`, t`ユーザーと権限`, t`変更の記録`];

  return (
    <nav aria-label={t`管理メニュー`} className="flex flex-col gap-1">
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
    </nav>
  );
}
