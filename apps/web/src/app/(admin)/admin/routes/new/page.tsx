import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RouteEditor } from "@/components/admin/RouteEditor";
import { AdminBack } from "@/components/admin/AdminBack";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import { emptyDraft } from "@/lib/admin/route-draft";
import type { AdminRouteSummary } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`新しいルート（管理）`) };
}

export default async function NewRoutePage() {
  const i18n = await initLingui();
  const all = await adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes");
  const order = (all.body?.ok ? all.body.routes.length : 0) + 1;

  return (
    <div className="flex flex-col gap-4">
      <RouteEditor back={<AdminBack href="/admin/routes"><Trans>ルート</Trans></AdminBack>} initial={emptyDraft()} order={order} locale={i18n.locale} />
    </div>
  );
}
