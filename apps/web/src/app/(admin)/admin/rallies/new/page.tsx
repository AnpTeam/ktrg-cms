import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RallyCreate } from "@/components/admin/RallyCreate";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";
import type { AdminRallyCourse, AdminRallyPlace, AdminRouteSummary } from "@/lib/admin/types";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`新しいラリー（管理）`) };
}

// Everything a new rally may hold is fetched here at once (every stamp place and every course), so switching
// between "by places" and "by courses" on the page needs no further request.
export default async function NewRallyPage() {
  const i18n = await initLingui();
  const [places, courses, routes] = await Promise.all([
    adminGet<{ ok: true; candidates: AdminRallyPlace[] }>("/rallies/candidates?kind=places"),
    adminGet<{ ok: true; candidates: AdminRallyCourse[] }>("/rallies/candidates?kind=course"),
    adminGet<{ ok: true; routes: AdminRouteSummary[] }>("/routes"),
  ]);
  if (!places.body?.ok || !courses.body?.ok || !routes.body?.ok) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
        <Trans>ラリーを読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
      </p>
    );
  }
  const routeNames = Object.fromEntries(routes.body.routes.map((r) => [r.id, i18n.locale === "en" && r.nameEn ? r.nameEn : r.nameJa]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link href="/admin/rallies" className="tap-target inline-flex w-fit items-center text-lg font-bold text-accent underline underline-offset-4">
        <Trans>ラリー一覧にもどる</Trans>
      </Link>
      <RallyCreate places={places.body.candidates} courses={courses.body.candidates} routeNames={routeNames} locale={i18n.locale} />
    </div>
  );
}
