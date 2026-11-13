"use client";

import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { outcome } from "@/lib/admin/admin-client";
import { api } from "@/lib/api";
import {
  estimateWrites,
  IMPORT_WRITE_LIMIT,
  photoNamesIn,
  readPlaceRows,
  readRouteRows,
  runImport,
  type ImportApi,
  type PlaceRow,
  type ProblemKind,
  type ReportItem,
  type RouteRow,
  type RowProblem,
} from "@/lib/admin/sheet";
import { readSheets, templateBlob } from "@/lib/admin/sheet-file";
import type { AdminRoute, AdminRouteSummary, AdminSpot } from "@/lib/admin/types";

// The import on the routes page: download the template, fill it in, choose it (and the photos it names), look at
// what would change, then import. See lib/admin/sheet.ts for the rules.

interface Preview {
  routes: RouteRow[];
  places: PlaceRow[];
  problems: RowProblem[];
  photoNames: string[];
}

// The typed client's answers are shaped like the admin types; one place turns them into what the import needs.
const adapter: ImportApi = {
  async createRoute(body) {
    const r = await outcome(api.admin.routes.post(body));
    return r.ok ? { ok: true, value: r.data.route as unknown as AdminRoute } : { ok: false, key: r.key };
  },
  async updateRoute(id, updatedAt, changes) {
    const r = await outcome(api.admin.routes({ id }).patch({ updatedAt, ...changes }));
    return r.ok ? { ok: true, value: r.data.route as unknown as AdminRoute } : { ok: false, key: r.key };
  },
  async getRoute(id) {
    const r = await outcome(api.admin.routes({ id }).get());
    return r.ok ? { ok: true, value: { spots: r.data.spots as unknown as AdminSpot[] } } : { ok: false, key: r.key };
  },
  async createSpot(routeId, body) {
    const r = await outcome(api.admin.routes({ id: routeId }).spots.post(body));
    return r.ok ? { ok: true, value: r.data.spot as unknown as AdminSpot } : { ok: false, key: r.key };
  },
  async updateSpot(id, updatedAt, changes) {
    const r = await outcome(api.admin.spots({ id }).patch({ updatedAt, ...changes }));
    return r.ok ? { ok: true, value: r.data.spot as unknown as AdminSpot } : { ok: false, key: r.key };
  },
  async uploadPhoto(file) {
    const r = await outcome(api.admin.uploads.post({ file }));
    return r.ok ? { ok: true, value: r.data.upload.url } : { ok: false, key: r.key };
  },
};

export function RouteImport({ routes, onImported }: { routes: AdminRoute[]; onImported: (routes: AdminRouteSummary[]) => void }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [report, setReport] = useState<ReportItem[] | null>(null);

  const files = useMemo(() => new Map(photos.map((f) => [f.name.toLowerCase(), f])), [photos]);
  const where = (p: { sheet: "route" | "place"; line: number }) => (p.sheet === "route" ? t`「ルート」シート ${p.line} 行目` : t`「経由地」シート ${p.line} 行目`);
  const problemText: Record<ProblemKind, string> = {
    whole: t`整数で書いてください`,
    number: t`数字で書いてください`,
    prefecture: t`大阪府・和歌山県・奈良県のどれかで書いてください`,
    kind: t`「書き方」シートにある種類の名前で書いてください`,
    yesno: t`「はい」か「いいえ」で書いてください`,
    range: t`範囲をこえています`,
    pair: t`緯度と経度は、両方書いてください`,
    duplicate: t`同じ番号の行が、前にもあります`,
    missing: t`書いてありません`,
  };
  const skipText = (r: NonNullable<ReportItem["reason"]>) =>
    r === "name_required"
      ? t`新しく作るには、名前（日本語）が必要です`
      : r === "route_gap"
        ? t`前の番号のルートがまだないので、作れません`
        : r === "route_missing"
          ? t`このルートがまだありません`
          : r === "place_gap"
            ? t`前の番号の経由地がまだないので、作れません`
            : messages[r];

  async function download() {
    const url = URL.createObjectURL(await templateBlob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "route-import-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function check() {
    setNotice(null);
    setReport(null);
    setPreview(null);
    if (!sheet) return;
    const rows = await readSheets(sheet).catch(() => null);
    if (!rows) return setNotice(t`このファイルは読み取れませんでした。「ひな形」から作ったファイル（.xlsx）を選んでください。`);
    const r = readRouteRows(rows.routes);
    const p = readPlaceRows(rows.places);
    setPreview({ routes: r.rows, places: p.rows, problems: [...r.problems, ...p.problems], photoNames: photoNamesIn(r.rows, p.rows) });
  }

  async function run() {
    if (!preview) return;
    setProgress([0, preview.routes.length + preview.places.length]);
    const done = await runImport({ routes: preview.routes, places: preview.places, existing: routes, photos: files }, adapter, (d, n) => setProgress([d, n]));
    // The list on the page is out of date now (new routes, new saved times): load it again, so another check
    // or import starts from what is really saved and does not create the same routes twice.
    const fresh = await outcome(api.admin.routes.get());
    if (fresh.ok) onImported(fresh.data.routes as unknown as AdminRouteSummary[]);
    else setNotice(messages[fresh.key]);
    setProgress(null);
    setPreview(null);
    setReport(done);
  }

  const writes = preview ? estimateWrites(preview.routes, preview.places, new Set(files.keys())) : 0;
  const tooMany = writes > IMPORT_WRITE_LIMIT;
  const missingPhotos = preview ? preview.photoNames.filter((n) => !files.has(n)) : [];
  const updating = preview ? preview.routes.filter((r) => r.number <= routes.length).length : 0;
  // New routes are only made one after another (the next number each time), so a row that jumps ahead is not counted.
  let next = routes.length + 1;
  const creating = (preview?.routes ?? []).filter((r) => r.number === next && ++next).length;
  const button = "tap-target inline-flex items-center rounded-full border border-line px-5 text-lg font-bold";
  const quiet = "tap-target inline-flex items-center px-2 text-base underline underline-offset-4";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2">
      <button type="button" onClick={download} className={quiet}>
        {t`ひな形をダウンロード`}
      </button>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={quiet}>
        {t`ファイルから取り込む`}
      </button>

      {open ? (
        <section aria-label={t`ファイルから取り込む`} className="flex basis-full flex-col gap-4 rounded-2xl bg-surface p-5">
          <p className="text-lg">
            {t`ひな形（.xlsx）に書いて、ここで選びます。空のセルは「今のまま」です。取り込んだだけでは、公開されません。`}
          </p>
          <label className="flex flex-col gap-1 text-base font-bold">
            {t`書いたファイル（.xlsx）`}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setSheet(e.target.files?.[0] ?? null);
                setPreview(null);
                setReport(null);
              }}
              className="tap-target rounded-full border border-line bg-paper px-4 text-base font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-base font-bold">
            {t`写真（シートに書いたファイル名と同じ名前のもの。まとめて選べます）`}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhotos([...(e.target.files ?? [])])}
              className="tap-target rounded-full border border-line bg-paper px-4 text-base font-normal"
            />
          </label>
          <button type="button" disabled={!sheet || progress !== null} onClick={check} className={`${button} self-start disabled:opacity-40`}>
            {t`内容を確認する`}
          </button>

          {notice ? (
            <p role="alert" className="text-lg font-bold text-danger">
              {notice}
            </p>
          ) : null}

          {preview ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="text-lg font-bold">
                {t`ルート ${preview.routes.length} 行（今あるものを更新 ${updating}、新しく作る ${creating}）、経由地 ${preview.places.length} 行`}
              </p>
              {preview.photoNames.length > 0 ? (
                <p className="text-base">{t`写真 ${preview.photoNames.length - missingPhotos.length} / ${preview.photoNames.length} 枚が、選んだファイルの中にありました。`}</p>
              ) : null}
              {missingPhotos.length > 0 ? (
                <p className="text-base text-danger">{t`見つからない写真（その写真だけ入りません）：${missingPhotos.join("、")}`}</p>
              ) : null}
              {preview.problems.length > 0 ? (
                <div>
                  <p className="text-base font-bold text-danger">{t`次の行は、まちがいがあるので取り込みません：`}</p>
                  <ul className="list-disc pl-6 text-base">
                    {preview.problems.map((p, i) => (
                      <li key={i}>
                        {where(p)}「{p.column}」：{problemText[p.problem]}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {tooMany ? (
                <p role="alert" className="text-lg font-bold text-danger">
                  {t`一度に取り込める数をこえています（${writes} 回の保存が必要で、上限は ${IMPORT_WRITE_LIMIT} 回です）。ファイルを分けて、時間をおいて取り込んでください。`}
                </p>
              ) : null}
              <button
                type="button"
                disabled={tooMany || progress !== null || preview.routes.length + preview.places.length === 0}
                onClick={run}
                className="tap-target inline-flex items-center self-start rounded-full bg-ink px-5 text-lg font-bold text-paper disabled:opacity-40"
              >
                {t`この内容で取り込む`}
              </button>
            </div>
          ) : null}

          {progress ? (
            <p role="status" className="text-lg font-bold">
              {t`取り込み中… ${progress[0]} / ${progress[1]}`}
            </p>
          ) : null}

          {report ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="text-lg font-bold">
                {t`取り込みました：作成 ${report.filter((r) => r.status === "created").length}、更新 ${report.filter((r) => r.status === "updated").length}、取り込めなかった行 ${report.filter((r) => r.status === "skipped").length}`}
              </p>
              {report.some((r) => r.status === "skipped" || r.photo) ? (
                <ul className="list-disc pl-6 text-base">
                  {report.flatMap((r, i) => [
                    r.status === "skipped" && r.reason ? (
                      <li key={`s${i}`} className="text-danger">
                        {where(r)}：{skipText(r.reason)}
                      </li>
                    ) : null,
                    r.photo ? (
                      <li key={`p${i}`}>
                        {where(r)}：{t`写真「${r.photo.name}」は入りませんでした（${r.photo.reason === "photo_missing" ? t`選んだファイルの中にありません` : messages[r.photo.reason]}）`}
                      </li>
                    ) : null,
                  ])}
                </ul>
              ) : null}
              <p className="text-base">{t`位置を取り込んだ経由地は「位置を確認していない」状態です。出どころを調べて、編集画面で確認してください。`}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
