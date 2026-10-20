"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { nameChanges, sameOrder } from "@/lib/admin/rally-edit";
import type { AdminRally } from "@/lib/admin/types";
import { MultilingualField, Section } from "./fields";
import { RallyMemberPicker, type RallyCandidates } from "./RallyMemberPicker";

type Notice = { kind: "saved" | "error"; text: string } | null;

// One rally: its names, whether visitors see it, what is in it (places or courses, by its type), and deleting it.
// Every save sends the updatedAt it loaded, so nobody overwrites a newer save; the members are saved in one go.
export function RallyEditor({
  initial,
  memberIds,
  candidates,
  routeNames,
  locale,
}: {
  initial: AdminRally;
  memberIds: string[];
  candidates: RallyCandidates;
  routeNames: Record<string, string>;
  locale: string;
}) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [names, setNames] = useState({ nameJa: initial.nameJa, nameEn: initial.nameEn ?? "", translations: initial.translations ?? {} });
  const [savedIds, setSavedIds] = useState(memberIds);
  const [ids, setIds] = useState(memberIds);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const changes = nameChanges(saved, names);
  const namesChanged = Object.keys(changes).length > 0;
  const membersChanged = !sameOrder(ids, savedIds);
  const title = locale === "en" && saved.nameEn ? saved.nameEn : saved.nameJa;

  const one = () => api.admin.rallies({ id: saved.id });
  const start = () => {
    setBusy(true);
    setNotice(null);
  };
  const finish = (res: { ok: true; rally: AdminRally } | { ok: false; key: keyof typeof messages }, text: string) => {
    setBusy(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: messages[res.key] });
      return null;
    }
    setSaved(res.rally);
    setNotice({ kind: "saved", text });
    return res.rally;
  };
  const asResult = (res: { ok: true; data: { rally: AdminRally } } | { ok: false; key: keyof typeof messages }) =>
    res.ok ? { ok: true as const, rally: res.data.rally } : res;

  async function saveNames() {
    start();
    const rally = finish(asResult(await outcome(one().patch({ updatedAt: saved.updatedAt, ...changes }))), t`保存しました。`);
    if (rally) setNames({ nameJa: rally.nameJa, nameEn: rally.nameEn ?? "", translations: rally.translations ?? {} });
  }

  async function setPublished(published: boolean) {
    start();
    finish(asResult(await outcome(one().patch({ updatedAt: saved.updatedAt, published }))), published ? t`公開しました。` : t`公開をやめました。`);
  }

  async function saveMembers() {
    start();
    const res =
      saved.kind === "places"
        ? await outcome(one().places.put({ updatedAt: saved.updatedAt, spotIds: ids }))
        : await outcome(one().courses.put({ updatedAt: saved.updatedAt, routeIds: ids }));
    if (finish(asResult(res), t`ラリーの中身を保存しました。`)) setSavedIds(ids);
  }

  async function remove() {
    const warning = saved.completionCount > 0 ? t`このラリーを削除します。達成した ${saved.completionCount} 人の達成記録も消えます（スタンプは残ります）。よろしいですか？` : t`このラリーを削除します。よろしいですか？`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    const res = await outcome(one().delete());
    setBusy(false);
    if (!res.ok) return setNotice({ kind: "error", text: messages[res.key] });
    router.push(`/admin/rallies`);
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-lg text-muted">
        {saved.kind === "places" ? t`経由地でつくったラリー：えらんだ経由地のスタンプを全部押すと達成。` : t`コースでつくったラリー：えらんだコースを全部終えると達成。`}
        {" "}
        {saved.published ? t`公開中` : t`下書き`}
        {" ・ "}
        {t`達成した人 ${saved.completionCount}`}
      </p>

      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-surface p-4 text-lg font-bold ${notice.kind === "error" ? "text-danger" : "text-moss"}`}>
          {notice.text}
        </p>
      ) : null}

      <Section title={t`名前と公開`}>
        <MultilingualField
          id="rally-name"
          label={t`ラリーの名前`}
          field="name"
          ja={names.nameJa}
          en={names.nameEn}
          translations={names.translations}
          onJa={(v) => setNames((n) => ({ ...n, nameJa: v }))}
          onEn={(v) => setNames((n) => ({ ...n, nameEn: v }))}
          onTranslations={(v) => setNames((n) => ({ ...n, translations: v }))}
          required
          invalid={names.nameJa.trim() === ""}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={saveNames} disabled={busy || !namesChanged || names.nameJa.trim() === ""} className="tap-target rounded-xl bg-brand px-6 text-lg font-bold text-on-brand disabled:opacity-50">
            {t`名前を保存`}
          </button>
          <button
            type="button"
            onClick={() => setPublished(!saved.published)}
            disabled={busy || namesChanged || membersChanged || (!saved.published && saved.memberCount === 0)}
            className="tap-target rounded-xl border-2 border-line px-6 text-lg font-bold disabled:opacity-50"
          >
            {saved.published ? t`公開をやめる` : t`公開する`}
          </button>
        </div>
        {namesChanged || membersChanged ? <p className="text-base text-muted">{t`保存していない変更があります。先に保存してから公開を切りかえてください。`}</p> : null}
      </Section>

      <Section title={saved.kind === "places" ? t`ラリーに入る経由地` : t`ラリーに入るコース`}>
        <RallyMemberPicker candidates={candidates} selected={ids} onChange={setIds} routeNames={routeNames} locale={locale} disabled={busy} />
        <button type="button" onClick={saveMembers} disabled={busy || !membersChanged} className="tap-target w-fit rounded-xl bg-brand px-6 text-lg font-bold text-on-brand disabled:opacity-50">
          {t`ラリーの中身を保存`}
        </button>
        <p className="text-base text-muted">{t`下書きの経由地は、公開されるまで数に入りません。スタンプの記録は変わりません。`}</p>
      </Section>

      <Section title={t`削除`}>
        <p className="text-base">{t`ラリーを削除しても、スタンプやコースの達成は消えません。このラリーの達成記録だけが消えます。`}</p>
        <button type="button" onClick={remove} disabled={busy} className="tap-target w-fit rounded-xl border-2 border-danger px-6 text-lg font-bold text-danger disabled:opacity-50">
          {t`このラリーを削除`}
        </button>
      </Section>
    </div>
  );
}
