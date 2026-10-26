"use client";

import Link from "next/link";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { itemFacts, itemHref, itemName, type ListItem, type ListMeta } from "@/lib/admin/lists/config";
import { listRequest } from "@/lib/admin/lists/list-client";

// Places that look entered twice (same name, near each other), in groups. The first of a group is the most complete one,
// and is the one to keep; each place can be deleted here, or all but the first at once.
export function DuplicateFinder({ meta, locale, choices, onChanged }: { meta: ListMeta; locale: string; choices: Record<string, { id: string; name: string }[]>; onChanged: () => void }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [groups, setGroups] = useState<ListItem[][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routeName = (id: string, field: string) => choices[field]?.find((c) => c.id === id)?.name ?? null;

  async function find() {
    setBusy(true);
    setError(null);
    const res = await listRequest<{ groups: ListItem[][] }>("GET", "directory/duplicates");
    setBusy(false);
    if (!res.ok) return setError(messages[res.key]);
    setGroups(res.data.groups);
  }

  async function remove(ids: string[]) {
    const ask = ids.length === 1 ? t`この場所を削除します。元に戻せません。よろしいですか？` : t`${ids.length}件を削除します。元に戻せません。よろしいですか？`;
    if (busy || !window.confirm(ask)) return;
    setBusy(true);
    setError(null);
    const gone = new Set<string>();
    let failure: string | null = null;
    for (const id of ids) {
      const res = await listRequest("DELETE", `${meta.key}/${id}`);
      if (res.ok) gone.add(id);
      else failure = messages[res.key];
    }
    setBusy(false);
    setGroups((now) => (now ?? []).map((g) => g.filter((p) => !gone.has(p.id))).filter((g) => g.length > 1));
    if (failure) setError(failure);
    if (gone.size > 0) onChanged();
  }

  return (
    <details className="rounded-2xl border-2 border-line p-4">
      <summary className="cursor-pointer text-lg font-bold">{t`重複している場所をさがす`}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-base text-muted">{t`同じ名前で、位置が近い（150m以内、または位置が未入力）場所を、グループにして出します。各グループの先頭が、いちばん情報がそろっている場所です（残すのにおすすめ）。`}</p>
        <button type="button" disabled={busy} onClick={() => void find()} className="tap-target w-fit rounded-xl bg-ink px-5 text-lg font-bold text-paper disabled:opacity-50">
          {busy && groups === null ? t`さがしています…` : t`さがす`}
        </button>
        {error ? (
          <p role="alert" className="text-lg font-bold text-danger">
            {error}
          </p>
        ) : null}
        {groups?.length === 0 ? <p className="text-lg font-bold">{t`重複しているように見える場所はありません。`}</p> : null}
        {groups?.map((group) => (
          <div key={group[0]!.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-bold">{t`${itemName(meta, group[0]!, locale)}（${group.length}件）`}</p>
              <button type="button" disabled={busy} onClick={() => void remove(group.slice(1).map((p) => p.id))} className="tap-target rounded-xl border-2 border-danger px-4 text-base font-bold text-danger disabled:opacity-50">
                {t`先頭だけ残して、ほかを削除`}
              </button>
            </div>
            <ul className="flex flex-col divide-y divide-line">
              {group.map((p, i) => {
                const href = itemHref(meta, p);
                return (
                  <li key={p.id} className="flex items-start gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      {i === 0 ? <span className="mr-2 rounded-md bg-ink px-2 py-0.5 text-sm font-bold text-paper">{t`残すのにおすすめ`}</span> : null}
                      {href ? (
                        <Link href={href} target="_blank" className="text-lg font-bold text-accent underline underline-offset-4">
                          {itemName(meta, p, locale)}
                        </Link>
                      ) : null}
                      <p className="text-base text-muted">{itemFacts(meta, p, locale, routeName).join(" ・ ")}</p>
                      {typeof p.address === "string" && p.address ? <p className="text-base text-muted">{p.address}</p> : null}
                    </div>
                    <button type="button" disabled={busy} onClick={() => void remove([p.id])} className="tap-target shrink-0 rounded-xl border-2 border-line px-3 text-base font-bold text-danger disabled:opacity-50">
                      {t`削除`}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
