import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CommentInbox } from "@/components/admin/CommentInbox";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { commentPageOf, inboxQuery } from "@/lib/admin/comment-inbox";
import { pick } from "@/lib/admin/lists/config";
import type { ListPage } from "@/lib/admin/lists/list-client";
import { listMetaOr404 } from "@/lib/admin/lists/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`コメント（管理）`) };
}

// The comments as an inbox (CommentInbox), opening on the ones waiting for a look. It takes the place of the generic list page.
export default async function AdminCommentsPage() {
  const i18n = await initLingui();
  const meta = await listMetaOr404("comments"); // also checks the permission
  const { status, body } = await adminGet<{ ok: true } & ListPage>(`/lists/comments?${inboxQuery("pending", "", 1)}`);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <h1 className="text-3xl font-bold">{pick(meta.title, i18n.locale)}</h1>
      <p className="text-lg text-muted">{pick(meta.intro, i18n.locale)}</p>
      {status === 200 && body?.ok ? (
        <CommentInbox initial={commentPageOf(body)} locale={i18n.locale} />
      ) : (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>コメントを読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      )}
    </div>
  );
}
