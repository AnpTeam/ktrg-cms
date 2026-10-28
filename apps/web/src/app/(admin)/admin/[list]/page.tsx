import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AdminListTable } from "@/components/admin/AdminListTable";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { pick } from "@/lib/admin/lists/config";
import type { ListPage } from "@/lib/admin/lists/list-client";
import { listMetaOr404, relationChoices } from "@/lib/admin/lists/server";

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  const i18n = await initLingui();
  const title = pick((await listMetaOr404((await params).list)).title, i18n.locale);
  return { title: i18n._(msg`${title}（管理）`) };
}

/** Any generic admin list, drawn from the API's description of it: newest first, 50 at a time. */
export default async function AdminListPage({ params }: { params: Promise<{ list: string }> }) {
  const i18n = await initLingui();
  const meta = await listMetaOr404((await params).list);
  const [{ status, body }, choices] = await Promise.all([adminGet<{ ok: true } & ListPage>(`/lists/${meta.key}?page=1`), relationChoices(meta, i18n.locale)]);
  // The whole answer, not just the rows: it carries which page this is, how many there are and the total the pager needs.
  const page: ListPage | null = status === 200 && body?.ok ? body : null;
  const title = pick(meta.title, i18n.locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-lg text-muted">{pick(meta.intro, i18n.locale)}</p>
      {page ? (
        <AdminListTable meta={meta} initial={page} locale={i18n.locale} choices={choices} />
      ) : (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>{title}を読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      )}
    </div>
  );
}
