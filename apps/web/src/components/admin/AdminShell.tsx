import Link from "next/link";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AdminFrame, SidebarToggle } from "./AdminFrame";
import { AdminNav } from "./AdminNav";

// The frame of every admin page: a menu on the left (a strip on top on a narrow screen), a bar with the
// signed-in name, the language and a way back to the site visitors see, and the page itself.
export function AdminShell({ name, lists, children }: { name: string | null; lists: { key: string; title: string }[]; children: ReactNode }) {
  return (
    <AdminFrame
      aside={
        <>
          <Link href="/admin/routes" className="tap-target mb-3 flex items-center px-2 text-xl font-bold text-accent">
            <Trans>葛城修験 管理</Trans>
          </Link>
          <AdminNav lists={lists} />
        </>
      }
    >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <SidebarToggle />
            <p className="text-base text-muted">
            {name ? <Trans>{name} さんでログイン中</Trans> : <Trans>管理者としてログイン中</Trans>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher />
            <Link href="/" className="tap-target inline-flex items-center text-base font-bold text-accent underline underline-offset-4">
              <Trans>公開サイトを見る</Trans>
            </Link>
          </div>
        </header>
        <main id="main" className="px-4 py-6 lg:px-8">
          {children}
        </main>
    </AdminFrame>
  );
}
