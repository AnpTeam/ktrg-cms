import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import Link from "next/link";
import { RouteEditor } from "@/components/admin/RouteEditor";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { draftFromServer } from "@/lib/admin/route-draft";
import type { AdminRoute, AdminRouteSummary, AdminSpot } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ルートを直す（管理）`) };
}

export default async function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const i18n = await initLingui();
  const { id } = await params;
  const [one, all] = await Promise.all([
    adminGet<{ ok: true; route: AdminRoute; spots: AdminSpot[] }>(`/routes/${encodeURIComponent(id)}`),
    adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes"),
  ]);
  if (one.status === 404) notFound();

  if (one.status !== 200 || !one.body?.ok) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
        <Trans>ルートを読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
      </p>
    );
  }
  const order = (all.body?.ok ? all.body.routes.findIndex((r) => r.id === id) : -1) + 1;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/routes" className="tap-target inline-flex w-fit items-center text-lg font-bold text-accent underline underline-offset-4">
        <Trans>ルート一覧にもどる</Trans>
      </Link>
      <RouteEditor initial={draftFromServer(one.body.route, one.body.spots)} order={order || 1} locale={i18n.locale} />
    </div>
  );
}
