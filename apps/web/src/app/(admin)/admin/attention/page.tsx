import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { WarningIcon } from "@/components/icons";
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

/** What keeps a line or a place from visitors, so it comes first and in red. The rest only makes a page better. */
const URGENT = new Set(["no_line", "line_unchecked", "position_unchecked"]);
const urgentIn = (issues: string[]) => issues.filter((i) => URGENT.has(i)).length;

/** Never colour alone: an urgent item also has the warning sign and heavier words. */
function Issues({ issues, words }: { issues: string[]; words: Record<string, string> }) {
  return (
    <ul className="flex flex-wrap gap-2 text-base">
      {[...issues].sort((a, b) => Number(URGENT.has(b)) - Number(URGENT.has(a))).map((i) =>
        URGENT.has(i) ? (
          <li key={i} className="inline-flex items-center gap-1 rounded-md border-2 border-danger bg-paper px-2 py-0.5 font-bold text-danger">
            <WarningIcon />
            {words[i] ?? i}
          </li>
        ) : (
          <li key={i} className="rounded-md bg-paper px-2 py-0.5 text-muted">
            {words[i] ?? i}
          </li>
        ),
      )}
    </ul>
  );
}

function Tile({ n, urgent = false, children }: { n: number; urgent?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col rounded-lg bg-surface p-4 ${urgent && n > 0 ? "border-l-4 border-danger" : ""}`}>
      <span className={`font-serif text-4xl font-bold tabular-nums ${urgent && n > 0 ? "text-danger" : ""}`}>{n}</span>
      <span className="text-lg font-bold">{children}</span>
    </div>
  );
}

// One page that lists what is missing (an unchecked line, no English name, no photo ...), so nobody has to open every route.
// One card per course, the courses with the most urgent things first.
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

  const courses = new Map<string, { id: string; nameJa: string; issues: string[]; spots: Found["spots"] }>();
  for (const r of found?.routes ?? []) courses.set(r.id, { ...r, spots: [] });
  for (const s of found?.spots ?? []) {
    const course = courses.get(s.routeId) ?? { id: s.routeId, nameJa: s.routeNameJa, issues: [], spots: [] };
    courses.set(s.routeId, { ...course, spots: [...course.spots, s] });
  }
  const urgentOf = (c: { issues: string[]; spots: Found["spots"] }) => urgentIn(c.issues) + c.spots.reduce((n, s) => n + urgentIn(s.issues), 0);
  const list = [...courses.values()].sort((a, b) => urgentOf(b) - urgentOf(a));
  const urgent = list.reduce((n, c) => n + urgentOf(c), 0);
  const all = list.reduce((n, c) => n + c.issues.length + c.spots.reduce((m, s) => m + s.issues.length, 0), 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>直すところ</Trans>
      </h1>
      {!found ? (
        <p role="alert" className="rounded-lg border-l-4 border-danger bg-surface p-6 text-lg font-bold text-danger">
          <Trans>読み込めませんでした。しばらくしてから、ページを開き直してください。</Trans>
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-lg bg-surface p-6 text-lg font-bold">
          <Trans>直すところは、ありません。</Trans>
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile n={urgent} urgent>
              <Trans>先に直すもの</Trans>
            </Tile>
            <Tile n={all - urgent}>
              <Trans>あとで足すもの</Trans>
            </Tile>
            <Tile n={list.length}>
              <Trans>関係するルート</Trans>
            </Tile>
          </div>
          <p className="text-lg text-muted">
            <Trans>赤いものは、直すまで訪問者に見えません。名前を押すと、そのルートの編集画面が開きます。</Trans>
          </p>
          {list.map((c) => (
            <section key={c.id} className={`flex flex-col gap-3 rounded-lg bg-surface p-4 ${urgentOf(c) > 0 ? "border-l-4 border-danger" : ""}`}>
              <h2 className="text-xl font-bold">
                <Link href={`/admin/routes/${c.id}${c.issues.some((i) => URGENT.has(i)) ? "?tab=map" : ""}`} className="tap-target inline-flex items-center underline underline-offset-4">
                  {c.nameJa}
                </Link>
              </h2>
              {c.issues.length > 0 ? <Issues issues={c.issues} words={words} /> : null}
              {c.spots.length > 0 ? (
                <ul className="flex flex-col divide-y divide-line">
                  {[...c.spots]
                    .sort((a, b) => urgentIn(b.issues) - urgentIn(a.issues))
                    .map((s) => (
                      <li key={s.id} className="flex flex-col gap-1 py-2">
                        <p className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/routes/${c.id}?tab=places`} className="tap-target inline-flex items-center text-lg font-bold underline underline-offset-4">
                            {s.nameJa}
                          </Link>
                          {s.published ? null : (
                            <span className="rounded-md border border-dashed border-line px-1.5 text-base text-muted">
                              <Trans>下書き</Trans>
                            </span>
                          )}
                        </p>
                        <Issues issues={s.issues} words={words} />
                      </li>
                    ))}
                </ul>
              ) : null}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
