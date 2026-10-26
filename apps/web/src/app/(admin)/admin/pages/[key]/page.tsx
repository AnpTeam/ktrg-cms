import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AdminBack } from "@/components/admin/AdminBack";
import { PageTextEditor } from "@/components/admin/PageTextEditor";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { PAGE_KEYS, type PageKey, type PageText } from "@/lib/page-text";
import { builtInPages } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ページの文章（管理）`) };
}

export default async function EditPageText({ params }: { params: Promise<{ key: string }> }) {
  const i18n = await initLingui();
  const { key } = await params;
  if (!(PAGE_KEYS as readonly string[]).includes(key)) notFound();
  const { body } = await adminGet<{ ok: true; pages: Partial<Record<PageKey, PageText | null>> }>("/settings/pages");
  // A page this person may not change is not in the answer (the terms and privacy are for an admin).
  if (!body?.ok || !(key in body.pages)) notFound();
  const saved = body.pages[key as PageKey] ?? null;
  const builtIn = builtInPages()[key as PageKey];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <AdminBack href="/admin/pages">
        <Trans>ページの文章へ戻る</Trans>
      </AdminBack>
      <PageTextEditor pageKey={key as PageKey} saved={saved} builtIn={builtIn} locale={i18n.locale} />
    </div>
  );
}
