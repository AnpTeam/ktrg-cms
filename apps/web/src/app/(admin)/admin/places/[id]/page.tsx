import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AdminBack } from "@/components/admin/AdminBack";
import { WaypointEditor } from "@/components/admin/WaypointEditor";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { pick } from "@/lib/admin/lists/config";
import { listMetaOr404 } from "@/lib/admin/lists/server";
import { draftFromServer } from "@/lib/admin/route-draft";
import type { AdminRoute, AdminSpot } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`経由地を直す（管理）`) };
}

/** One waypoint, edited where the list is. A place on two courses is edited here once, on its home course. */
export default async function EditWaypointPage({ params }: { params: Promise<{ id: string }> }) {
  const i18n = await initLingui();
  const { id } = await params;
  const meta = await listMetaOr404("places");
  const one = await adminGet<{ ok: true; item: { routeId: string } }>(`/lists/places/${encodeURIComponent(id)}`);
  if (one.status === 404 || one.status === 422) notFound();
  if (!one.body?.ok) throw new Error("waypoint not loaded");
  const routeId = one.body.item.routeId;
  const route = await adminGet<{ ok: true; route: AdminRoute; spots: AdminSpot[] }>(`/routes/${encodeURIComponent(routeId)}`);
  if (!route.body?.ok || !route.body.spots.some((s) => s.id === id)) notFound();

  const name = pick({ ja: route.body.route.nameJa, en: route.body.route.nameEn ?? route.body.route.nameJa }, i18n.locale);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <AdminBack href="/admin/places">
        <Trans>経由地の一覧へ戻る</Trans>
      </AdminBack>
      <p className="text-lg">
        <Trans>ルート：{name}</Trans>{" "}
        <Link href={`/admin/routes/${routeId}`} className="tap-target inline-flex items-center text-base underline underline-offset-4">
          <Trans>ルートの画面で開く</Trans>
        </Link>
      </p>
      <WaypointEditor initial={draftFromServer(route.body.route, route.body.spots)} placeId={id} deleteWarning={pick(meta.deleteWarning!, i18n.locale)} />
    </div>
  );
}
