import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AdminItemForm } from "@/components/admin/AdminItemForm";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { itemName, pick } from "@/lib/admin/lists/config";
import type { OneItem } from "@/lib/admin/lists/list-client";
import { listMetaOr404, routeChoices } from "@/lib/admin/lists/server";

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  const i18n = await initLingui();
  const title = pick((await listMetaOr404((await params).list)).title, i18n.locale);
  return { title: i18n._(msg`${title}を直す（管理）`) };
}

export default async function EditListItemPage({ params }: { params: Promise<{ list: string; id: string }> }) {
  const i18n = await initLingui();
  const { list, id } = await params;
  const meta = await listMetaOr404(list);
  if (!meta.ops.edit) notFound();
  const [one, routes] = await Promise.all([adminGet<{ ok: true } & OneItem>(`/lists/${meta.key}/${encodeURIComponent(id)}`), routeChoices(meta, i18n.locale)]);
  if (one.status === 404 || one.status === 422) notFound();
  const item = one.status === 200 && one.body?.ok ? one.body.item : null;
  const title = pick(meta.title, i18n.locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link href={`/${i18n.locale}/admin/${meta.key}`} className="tap-target inline-flex w-fit items-center text-lg font-bold text-accent underline underline-offset-4">
        <Trans>一覧へ戻る</Trans>
      </Link>
      {item ? (
        <>
          <h1 className="text-3xl font-bold">{itemName(meta, item, i18n.locale)}</h1>
          <AdminItemForm meta={meta} initial={item} locale={i18n.locale} routes={routes} />
        </>
      ) : (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>{title}を読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      )}
    </div>
  );
}
