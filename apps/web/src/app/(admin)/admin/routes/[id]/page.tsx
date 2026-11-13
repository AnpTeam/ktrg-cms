import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RouteEditor } from "@/components/admin/RouteEditor";
import { AdminBack } from "@/components/admin/AdminBack";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { draftFromServer } from "@/lib/admin/route-draft";
import type { AdminRoute, AdminRouteSummary, AdminSharedSpot, AdminSpot } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ルートを直す（管理）`) };
}

export default async function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const i18n = await initLingui();
  const { id } = await params;
  const [one, all] = await Promise.all([
    adminGet<{ ok: true; route: AdminRoute; spots: AdminSpot[]; shared: AdminSharedSpot[]; sharedWith: Record<string, string[]> }>(`/routes/${encodeURIComponent(id)}`),
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
      <RouteEditor back={<AdminBack href="/admin/routes"><Trans>もどる</Trans></AdminBack>} initial={draftFromServer(one.body.route, one.body.spots)} order={order || 1}
        locale={i18n.locale}
        shared={one.body.shared ?? []}
        sharedWith={one.body.sharedWith ?? {}}
        routeNames={Object.fromEntries((all.body?.ok ? all.body.routes : []).map((r) => [r.id, i18n.locale === "en" && r.nameEn ? r.nameEn : r.nameJa]))}
      />
    </div>
  );
}
