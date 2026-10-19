import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RouteTable } from "@/components/admin/RouteTable";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import type { AdminRouteSummary } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ルート（管理）`) };
}

export default async function AdminRoutesPage() {
  const i18n = await initLingui();
  const { status, body } = await adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes");
  const routes = status === 200 && body?.ok ? body.routes : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>ルート</Trans>
      </h1>
      <p className="text-lg text-muted">
        <Trans>歩く順番に並んでいます。名前を押すと、文章や地図を直せます。</Trans>
      </p>
      {routes ? (
        <RouteTable initial={routes} locale={i18n.locale} />
      ) : (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>ルートを読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      )}
    </div>
  );
}
