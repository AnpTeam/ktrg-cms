import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AdminItemForm } from "@/components/admin/AdminItemForm";
import { initLingui } from "@/i18n/server";
import { pick } from "@/lib/admin/lists/config";
import { listMetaOr404, routeChoices } from "@/lib/admin/lists/server";

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  const i18n = await initLingui();
  const meta = await listMetaOr404((await params).list);
  const label = pick(meta.newLabel ?? meta.title, i18n.locale);
  return { title: i18n._(msg`${label}（管理）`) };
}

export default async function NewListItemPage({ params }: { params: Promise<{ list: string }> }) {
  const i18n = await initLingui();
  const meta = await listMetaOr404((await params).list);
  if (!meta.ops.create || !meta.newLabel) notFound();
  const routes = await routeChoices(meta, i18n.locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link href={`/admin/${meta.key}`} className="tap-target inline-flex w-fit items-center text-lg font-bold text-accent underline underline-offset-4">
        <Trans>一覧へ戻る</Trans>
      </Link>
      <h1 className="text-3xl font-bold">{pick(meta.newLabel, i18n.locale)}</h1>
      <AdminItemForm meta={meta} initial={null} locale={i18n.locale} routes={routes} />
    </div>
  );
}
