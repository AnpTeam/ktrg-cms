import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BannerOrder, type BannerItem } from "@/components/admin/BannerOrder";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { pick } from "@/lib/admin/lists/config";
import { listMetaOr404 } from "@/lib/admin/lists/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`バナー（管理）`) };
}

/** The photos of the home page in the order visitors see them. Adding and editing one use the list screens. */
export default async function AdminBannersPage() {
  const i18n = await initLingui();
  const meta = await listMetaOr404("banners");
  const { status, body } = await adminGet<{ ok: true; items: BannerItem[] }>("/banners/order");
  const items = status === 200 && body?.ok ? body.items : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{pick(meta.title, i18n.locale)}</h1>
        <Link href="/admin/banners/new" className="tap-target inline-flex items-center rounded-full bg-ink px-5 text-lg font-bold text-paper">
          <Trans>新しいバナー</Trans>
        </Link>
      </div>
      <p className="text-lg text-muted">{pick(meta.intro, i18n.locale)}</p>
      {items ? (
        <BannerOrder initial={items} locale={i18n.locale} />
      ) : (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>バナーを読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      )}
    </div>
  );
}
