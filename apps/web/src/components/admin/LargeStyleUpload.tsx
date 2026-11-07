"use client";

import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { compactEntries, type Entry } from "@/lib/gsi-large-style";
import { confirmDialog } from "@/components/ConfirmDialog";

type Notice = { kind: "ok" | "error"; text: string } | null;

const MAX_FILE_BYTES = 6 * 1024 * 1024;

/**
 * Take the sizes and colours from a file saved in GSI's style editor (the 「大きい文字」 map). The file is read here in the
 * browser and cut down to the few settings used (a sixth of its size) before anything is sent. A file is only a draft until
 * 「反映する」: the preview map shows it first, and it is applied to every visitor's map after a confirmation.
 */
export function LargeStyleUpload({ draft, onDraft }: { draft: Entry[] | null; onDraft: (entries: Entry[] | null) => void }) {
  const { t } = useLingui();
  const [custom, setCustom] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Whether an uploaded file is in use already (the answer is large; only whether it exists matters here).
  useEffect(() => {
    let alive = true;
    void fetch("/api/v1/settings/large-style", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((b: { entries?: unknown }) => alive && setCustom(Array.isArray(b.entries)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function pick(file: File | undefined) {
    setNotice(null);
    onDraft(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setNotice({ kind: "error", text: t`ファイルが大きすぎます（6MBまで）。` });
    try {
      const tree: unknown = JSON.parse(await file.text());
      if (typeof tree !== "object" || tree === null || !Array.isArray((tree as { list?: unknown }).list)) throw new Error("shape");
      const entries = compactEntries(tree);
      if (entries.length === 0) throw new Error("empty");
      setName(file.name);
      onDraft(entries);
      setNotice({ kind: "ok", text: t`${entries.length}件の設定を読み込みました。下の見本で確かめて、よければ「反映する」を押してください。` });
    } catch {
      setNotice({ kind: "error", text: t`このファイルは読めません。国土地理院のスタイル編集で保存したJSONファイルを選んでください。` });
    }
  }

  async function send(entries: Entry[] | null) {
    const ask = entries ? t`このファイルの設定を、すぐにすべての訪問者の地図に反映します。よろしいですか？` : t`アップロードしたファイルをやめて、初めから入っている設定に戻します。よろしいですか？`;
    if (!(await confirmDialog({ title: t`サイトに反映しますか？`, body: ask, yes: entries ? t`反映する` : t`元に戻す` }))) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/admin/settings/large-style", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries }) });
      if (res.ok) {
        setCustom(entries !== null);
        onDraft(null);
        setNotice({ kind: "ok", text: entries ? t`反映しました。訪問者の地図には、数分のうちに変わります。` : t`初めから入っている設定に戻しました。` });
      } else {
        setNotice({ kind: "error", text: t`保存できませんでした。ファイルの中身か、電波を確かめてください。` });
      }
    } catch {
      setNotice({ kind: "error", text: t`保存できませんでした。ファイルの中身か、電波を確かめてください。` });
    }
    setBusy(false);
  }

  const button = "tap-target rounded-full border-2 border-line px-5 text-lg font-bold disabled:opacity-50";
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-lg font-bold">{t`国土地理院のスタイルファイル`}</legend>
      <p className="text-base text-muted">
        {custom === null ? "" : custom ? t`いまは、アップロードしたファイルの設定を使っています。` : t`いまは、初めから入っている設定を使っています。`}{" "}
        {t`国土地理院の「地理院地図Vector」のスタイル編集で保存したJSONファイルから、文字・記号・線の大きさと色を取り込みます。`}
      </p>
      <input type="file" accept="application/json,.json" onChange={(e) => void pick(e.target.files?.[0])} className="text-lg" aria-label={t`スタイルファイルを選ぶ`} />
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !draft} onClick={() => draft && void send(draft)} className={`${button} bg-ink text-paper`}>
          {t`反映する`}
        </button>
        <button type="button" disabled={busy || custom !== true} onClick={() => void send(null)} className={button}>
          {t`初めの設定に戻す`}
        </button>
      </div>
      {draft && name ? <p className="text-base">{name}</p> : null}
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-paper p-4 text-lg font-bold ${notice.kind === "error" ? "text-danger" : "text-moss"}`}>
          {notice.text}
        </p>
      ) : null}
    </fieldset>
  );
}
