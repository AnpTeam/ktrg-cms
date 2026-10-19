import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RallyEditor } from "@/components/admin/RallyEditor";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import type { AdminRally, AdminRallyCourse, AdminRallyPlace, AdminRouteSummary } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ラリーを直す（管理）`) };
}

type RallyAnswer = { ok: true; rally: AdminRally } & (
  | { places: (AdminRallyPlace & { position: number })[]; courses: null; candidates: AdminRallyPlace[] }
  | { places: null; courses: (AdminRallyCourse & { position: number })[]; candidates: AdminRallyCourse[] }
);

export default async function EditRallyPage({ params }: { params: Promise<{ id: string }> }) {
  const i18n = await initLingui();
  const { id } = await params;
  const [one, routes] = await Promise.all([
    adminGet<RallyAnswer>(`/rallies/${encodeURIComponent(id)}`),
    adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes"),
  ]);
  if (one.status === 404 || one.status === 422) notFound();
  if (one.status !== 200 || !one.body?.ok) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
        <Trans>ラリーを読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
      </p>
    );
  }
  const body = one.body;
  const routeNames = Object.fromEntries((routes.body?.ok ? routes.body.routes : []).map((r) => [r.id, i18n.locale === "en" && r.nameEn ? r.nameEn : r.nameJa]));
  const memberIds = body.places ? body.places.map((p) => p.spotId) : body.courses.map((c) => c.routeId);
  const candidates = body.places
    ? { kind: "places" as const, items: body.candidates as AdminRallyPlace[] }
    : { kind: "course" as const, items: body.candidates as AdminRallyCourse[] };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link href={`/${i18n.locale}/admin/rallies`} className="tap-target inline-flex w-fit items-center text-lg font-bold text-accent underline underline-offset-4">
        <Trans>ラリー一覧にもどる</Trans>
      </Link>
      <RallyEditor initial={body.rally} memberIds={memberIds} candidates={candidates} routeNames={routeNames} locale={i18n.locale} />
    </div>
  );
}
