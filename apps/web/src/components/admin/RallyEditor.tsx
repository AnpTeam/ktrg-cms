"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import { nameChanges, sameOrder } from "@/lib/admin/rally-edit";
import type { AdminRally } from "@/lib/admin/types";
import { Chip } from "./Chip";
import { MultilingualField, Section } from "./fields";
import { RallyMemberPicker, type RallyCandidates } from "./RallyMemberPicker";

type Notice = { kind: "saved" | "error"; text: string } | null;

// One rally: its names, whether visitors see it, what is in it (places or courses, by its type), and deleting it.
// Every save sends the updatedAt it loaded, so nobody overwrites a newer save; the members are saved in one go.
export function RallyEditor({
  initial,
  memberIds,
  candidates,
  otherCandidates,
  routeNames,
  locale,
}: {
  initial: AdminRally;
  memberIds: string[];
  candidates: RallyCandidates;
  /** What the other kind of rally could hold: offered when the way it is made is changed. */
  otherCandidates: RallyCandidates;
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
  const [cands, setCands] = useState({ mine: candidates, other: otherCandidates });
  const [switching, setSwitching] = useState(false);
  const [newIds, setNewIds] = useState<string[]>([]);

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

  /** The other way of making it: the old members go, the ticked ones come in, in one step. Visitors' finishes stay. */
  async function changeKind() {
    const to = cands.other.kind;
    const unfinished = saved.completionCount > 0 ? t`達成した ${saved.completionCount} 人の記録は残ります。` : "";
    if (!window.confirm(t`つくり方を変えます。いまの中身は外れ、えらんだものが入ります。${unfinished}よろしいですか？`)) return;
    start();
    const res = await outcome(one().kind.put({ updatedAt: saved.updatedAt, kind: to, ...(to === "places" ? { spotIds: newIds } : { routeIds: newIds }) }));
    if (finish(asResult(res), t`つくり方を変えました。`)) {
      setCands({ mine: cands.other, other: cands.mine });
      setSavedIds(newIds);
      setIds(newIds);
      setNewIds([]);
      setSwitching(false);
    }
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
      {/* The same title bar as the route editor: the name, the state, and the one button that matters, always in reach. */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3 lg:-mx-8 lg:px-8">
        <h1 className="min-w-0 flex-1 break-words text-2xl font-bold">{title}</h1>
        <Chip tone={saved.published ? "good" : "neutral"}>{saved.published ? t`公開中` : t`下書き`}</Chip>
        <button
          type="button"
          onClick={() => setPublished(!saved.published)}
          disabled={busy || namesChanged || membersChanged || (!saved.published && saved.memberCount === 0)}
          className={`tap-target rounded-full px-8 text-xl font-bold disabled:opacity-40 ${saved.published ? "border-2 border-ink bg-paper text-ink" : "bg-ink text-paper"}`}
        >
          {saved.published ? t`公開をやめる` : t`公開する`}
        </button>
      </div>
      <p className="text-lg text-muted">
        {saved.kind === "places" ? t`経由地でつくったラリー：えらんだ経由地のスタンプを全部押すと達成。` : t`コースでつくったラリー：えらんだコースを全部終えると達成。`}
        {" ・ "}
        {t`達成した人 ${saved.completionCount}`}
      </p>
      {namesChanged || membersChanged ? <p className="text-base text-muted">{t`保存していない変更があります。先に保存してから公開を切りかえてください。`}</p> : null}

      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-xl bg-surface p-4 text-lg font-bold ${notice.kind === "error" ? "text-danger" : "text-moss"}`}>
          {notice.text}
        </p>
      ) : null}

      <Section title={t`名前`}>
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
          <button type="button" onClick={saveNames} disabled={busy || !namesChanged || names.nameJa.trim() === ""} className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50">
            {t`名前を保存`}
          </button>
        </div>
      </Section>

      <Section title={saved.kind === "places" ? t`ラリーに入る経由地` : t`ラリーに入るコース`}>
        <RallyMemberPicker candidates={cands.mine} selected={ids} onChange={setIds} routeNames={routeNames} locale={locale} disabled={busy} />
        <button type="button" onClick={saveMembers} disabled={busy || !membersChanged} className="tap-target w-fit rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50">
          {t`ラリーの中身を保存`}
        </button>
        <p className="text-base text-muted">{t`下書きの経由地は、公開されるまで数に入りません。スタンプの記録は変わりません。`}</p>
      </Section>

      <Section title={t`つくり方`}>
        <p className="text-base">{saved.kind === "places" ? t`いまは「経由地でつくる」です。` : t`いまは「コースでつくる」です。`}</p>
        {switching ? (
          <div className="flex flex-col gap-4">
            <p className="text-base text-muted">
              {cands.other.kind === "course"
                ? t`「コースでつくる」に変えます。えらんだコースを全部歩き終えると達成になります。いまの経由地は外れるので、入れるコースをえらんでください。`
                : t`「経由地でつくる」に変えます。えらんだ経由地のスタンプを全部押すと達成になります。いまのコースは外れるので、入れる経由地をえらんでください。`}
            </p>
            <RallyMemberPicker candidates={cands.other} selected={newIds} onChange={setNewIds} routeNames={routeNames} locale={locale} disabled={busy} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={changeKind}
                disabled={busy || namesChanged || membersChanged || (saved.published && newIds.length === 0)}
                className="tap-target rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50"
              >
                {t`つくり方を変える`}
              </button>
              <button type="button" onClick={() => { setSwitching(false); setNewIds([]); }} disabled={busy} className="tap-target rounded-full border-2 border-line px-6 text-lg font-bold disabled:opacity-50">
                {t`やめる`}
              </button>
            </div>
            {namesChanged || membersChanged ? <p className="text-base text-muted">{t`保存していない変更があります。先に保存してください。`}</p> : null}
            {saved.published && newIds.length === 0 ? <p className="text-base text-muted">{t`公開中のラリーは、からにできません。1つ以上えらんでください。`}</p> : null}
          </div>
        ) : (
          <button type="button" onClick={() => setSwitching(true)} disabled={busy} className="tap-target w-fit rounded-full border-2 border-line px-6 text-lg font-bold disabled:opacity-50">
            {t`つくり方を変える…`}
          </button>
        )}
        <p className="text-base text-muted">{t`達成した人の記録は残ります。スタンプは変わりません。`}</p>
      </Section>

      <Section title={t`削除`}>
        <p className="text-base">{t`ラリーを削除しても、スタンプやコースの達成は消えません。このラリーの達成記録だけが消えます。`}</p>
        <button type="button" onClick={remove} disabled={busy} className="tap-target w-fit rounded-full border-2 border-danger px-6 text-lg font-bold text-danger disabled:opacity-50">
          {t`このラリーを削除`}
        </button>
      </Section>
    </div>
  );
}
