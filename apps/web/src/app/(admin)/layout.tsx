import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { AdminShell } from "@/components/admin/AdminShell";
import { initLingui } from "@/i18n/server";
import { adminAccess } from "@/lib/admin/access";
import { pick } from "@/lib/admin/lists/config";
import { adminLists } from "@/lib/admin/lists/server";
import { getViewer } from "@/lib/viewer";

// Search engines have no business here (robots.txt says so too).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The admin area. Signed-out visitors go to log in and come back; a signed-in account that is not an admin is told
 * so, with a way home. This only decides what is shown: the API checks the role again on every call.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();
  const viewer = await getViewer();
  const access = adminAccess(viewer);

  if (access === "login") {
    redirect(`/login?next=${encodeURIComponent("/admin/routes")}`);
  }

  if (access === "forbidden") {
    return (
      <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
        <h1 className="text-3xl font-bold">
          <Trans>このページを見る権限がありません</Trans>
        </h1>
        <p className="text-lg">
          <Trans>管理画面は、管理者だけが使えます。権限が必要な場合は、管理者にお知らせください。</Trans>
        </p>
        <Link href="/" className="tap-target inline-flex items-center text-lg font-bold text-accent underline underline-offset-4">
          <Trans>ホームへ戻る</Trans>
        </Link>
      </main>
    );
  }

  // The generic lists (described by the API) join the menu by themselves.
  const lists = ((await adminLists()) ?? []).map((l) => ({ key: l.key, title: pick(l.title, i18n.locale) }));
  return (
    <AdminShell name={viewer.name} lists={lists}>
      {children}
    </AdminShell>
  );
}
