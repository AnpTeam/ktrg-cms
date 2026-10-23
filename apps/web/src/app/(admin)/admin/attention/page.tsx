import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { adminGet } from "@/lib/admin/admin-fetch";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`直すところ（管理）`) };
}

interface Found {
  routes: { id: string; nameJa: string; issues: string[] }[];
  spots: { id: string; routeId: string; routeNameJa: string; nameJa: string; published: boolean; issues: string[] }[];
}

// One page that lists what is missing (an unchecked line, no English name, no photo ...), so nobody has to open every route.
export default async function AttentionPage() {
  const i18n = await initLingui();
  const words: Record<string, string> = {
    line_unchecked: i18n._(msg`線を確認していない`),
    no_line: i18n._(msg`線がない`),
    no_english_name: i18n._(msg`英語の名前がない`),
    no_photo: i18n._(msg`写真がない`),
    position_unchecked: i18n._(msg`位置を確認していない`),
  };
  const { status, body } = await adminGet<{ ok: true } & Found>("/attention");
  const found = status === 200 && body?.ok ? body : null;
  const bySpotRoute = new Map<string, Found["spots"]>();
  for (const s of found?.spots ?? []) bySpotRoute.set(s.routeId, [...(bySpotRoute.get(s.routeId) ?? []), s]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>直すところ</Trans>
      </h1>
      <p className="text-lg text-muted">
        <Trans>足りないものがあるルートと経由地です。名前を押すと、そのルートの編集画面が開きます。</Trans>
      </p>
      {!found ? (
        <p role="alert" className="rounded-2xl bg-surface p-6 text-lg font-bold text-danger">
          <Trans>読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      ) : found.routes.length === 0 && found.spots.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-lg font-bold">
          <Trans>直すところは、ありません。</Trans>
        </p>
      ) : (
        <>
          {found.routes.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">
                <Trans>ルート</Trans>
              </h2>
              <ul className="flex flex-col gap-2">
                {found.routes.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line bg-paper p-3">
                    <Link href={`/admin/routes/${r.id}`} className="text-lg font-bold underline underline-offset-4">
                      {r.nameJa}
                    </Link>
                    <p className="mt-1 flex flex-wrap gap-2 text-base">
                      {r.issues.map((i) => (
                        <span key={i} className="rounded-md bg-surface px-2 py-0.5">
                          {words[i] ?? i}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {[...bySpotRoute].map(([routeId, spots]) => (
            <section key={routeId} className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">
                <Link href={`/admin/routes/${routeId}`} className="underline underline-offset-4">
                  {spots[0]!.routeNameJa}
                </Link>
                <span className="ml-2 text-base font-normal text-muted">
                  <Trans>経由地</Trans>
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {spots.map((s) => (
                  <li key={s.id} className="rounded-xl border border-line bg-paper p-3">
                    <span className="text-lg font-bold">{s.nameJa}</span>
                    {s.published ? null : (
                      <span className="ml-2 rounded-md border border-dashed border-line px-1.5 text-sm text-muted">
                        <Trans>下書き</Trans>
                      </span>
                    )}
                    <p className="mt-1 flex flex-wrap gap-2 text-base">
                      {s.issues.map((i) => (
                        <span key={i} className="rounded-md bg-surface px-2 py-0.5">
                          {words[i] ?? i}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
