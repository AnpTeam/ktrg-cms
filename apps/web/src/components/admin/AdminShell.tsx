import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AdminFrame, SidebarToggle } from "./AdminFrame";
import { PublicSiteLink } from "./PublicSiteLink";
import { AdminNav } from "./AdminNav";

// The frame of every admin page: a menu on the left (folded behind a button on a narrow screen) that ends with who is signed
// in, the language and the theme, and the page itself. Its top holds the way to the same page on the site visitors see.
export function AdminShell({ name, role, lists, children }: { name: string | null; role: "editor" | "admin" | null; lists: { key: string; title: string }[]; children: ReactNode }) {
  return (
    <AdminFrame
      aside={
        <>
          {/* The site link left of the fold button; folded, they stack. */}
          <div className="mb-3 flex items-center gap-2 lg:group-data-[folded=true]:flex-col">
            <PublicSiteLink />
            <SidebarToggle />
          </div>
          <AdminNav
            lists={lists}
            isAdmin={role === "admin"}
            footer={
              <div className="mt-2 flex flex-col items-start gap-2 border-t border-line pt-3 lg:group-data-[folded=true]:hidden">
                <p className="text-base text-muted">{name ? <Trans>{name} さんでログイン中</Trans> : <Trans>管理者としてログイン中</Trans>}</p>
                <LocaleSwitcher />
                <ThemeSwitcher />
              </div>
            }
          />
        </>
      }
    >
      <main id="main" className="px-4 py-6 lg:px-8">
        {children}
      </main>
    </AdminFrame>
  );
}
