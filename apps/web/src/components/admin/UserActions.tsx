"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useReauth } from "@/components/auth/ReauthDialog";
import { useErrorMessages } from "@/components/useErrorMessages";
import { formatMoment, type ListItem } from "@/lib/admin/lists/config";
import { listRequest, type ListAnswer } from "@/lib/admin/lists/list-client";
import { endOfJstDay } from "@/lib/admin/lists/jst";
import { Field, inputClass, Section, TextInput } from "./fields";
import { showToast } from "@/lib/admin/toast";

/**
 * What an admin can do to an account besides changing its role: restrict it (it can look but not take part), ask for its
 * deletion with a week's notice to the owner (and cancel that), or delete it now (for a test account). Each one asks the admin to
 * confirm it is them (the fresh login step) and is refused for the admin's own account and for other admins.
 */
export function UserActions({ item, locale, onItem }: { item: ListItem; locale: string; onItem: (item: ListItem) => void }) {
  const { t } = useLingui();
  const router = useRouter();
  const messages = useErrorMessages();
  const { guard, dialog } = useReauth();
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const id = item.id;
  const restricted = item.restricted === true;
  const pending = item.deletionPending === true;
  const byAdmin = item.deletionByAdmin === true;
  const appeal = typeof item.deletionAppeal === "string" ? item.deletionAppeal : null;
  const memberId = String(item.publicId ?? "");

  /** Run one call behind the fresh-login step; show its error or the done text. */
  async function run(call: () => Promise<ListAnswer<{ item?: ListItem }>>, done: string, after?: () => void) {
    setBusy(true);
    showToast(null);
    let got: ListItem | null = null;
    const outcome = await guard(async () => {
      const res = await call();
      if (!res.ok) return { ok: false as const, code: res.key };
      got = res.data.item ?? null; // deleting an account answers with no row
      return { ok: true as const };
    });
    setBusy(false);
    if (!outcome.ok) return outcome.code === "cancelled" ? undefined : showToast({ kind: "error", text: messages[outcome.code] });
    if (got) onItem(got);
    showToast({ kind: "ok", text: done });
    after?.();
  }

  if (item.role === "admin") {
    return (
      <Section title={t`アカウントの制限・削除`}>
        <p className="text-lg">{t`管理者のアカウントは、制限や削除ができません。先に「権限」を変えてください。`}</p>
      </Section>
    );
  }

  return (
    <>
      <Section title={t`制限`}>
        <p className="text-base text-muted">{t`制限されたアカウントは、ログインと閲覧はできますが、スタンプを押すこととコメントを書くことはできません。自分のデータを見たり、削除を頼んだりはできます。`}</p>
        {restricted ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-xl border-2 border-danger p-3 text-lg">
              <span className="font-bold">{t`制限中`}</span>
              {item.restrictedUntil ? t`（${formatMoment(locale, String(item.restrictedUntil))} まで）` : t`（解除するまで）`}
              <br />
              {t`理由：${String(item.restrictionReason ?? "")}`}
            </p>
            <button type="button" disabled={busy} onClick={() => void run(() => listRequest<{ item?: ListItem }>("DELETE", `users/${id}/restriction`), t`制限を解除しました。`)} className="tap-target w-fit rounded-full border-2 border-ink px-6 text-lg font-bold disabled:opacity-50">
              {t`制限を解除する`}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label={t`理由（管理者だけに見えます）`} htmlFor="restrict-reason" required>
              <TextInput id="restrict-reason" value={reason} onChange={setReason} maxLength={200} />
            </Field>
            <Field label={t`いつまで（空なら、解除するまで）`} htmlFor="restrict-until">
              <input id="restrict-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={`${inputClass} max-w-60`} />
            </Field>
            <button
              type="button"
              disabled={busy || reason.trim() === ""}
              onClick={() => void run(() => listRequest<{ item?: ListItem }>("PUT", `users/${id}/restriction`, { reason: reason.trim(), until: until ? endOfJstDay(until) : null }), t`制限しました。`, () => setReason(""))}
              className="tap-target w-fit rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-50"
            >
              {t`制限する`}
            </button>
          </div>
        )}
      </Section>

      <Section title={t`アカウントの削除`}>
        {pending ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-xl border-2 border-caution p-3 text-lg font-bold">{byAdmin ? t`管理者が削除を予約しました。7日たつと、アカウントとスタンプが消えます。` : t`削除が予約されています。3日たつと、アカウントとスタンプが消えます。`}</p>
            {appeal ? (
              <div className="flex flex-col gap-1 rounded-xl bg-surface p-3">
                <p className="text-lg font-bold">{t`本人からの異議`}</p>
                <p className="whitespace-pre-line text-lg">{appeal}</p>
              </div>
            ) : null}
            <button type="button" disabled={busy} onClick={() => void run(() => listRequest<{ item?: ListItem }>("DELETE", `users/${id}/deletion-request`), t`削除の予約を取り消しました。`)} className="tap-target w-fit rounded-full border-2 border-ink px-6 text-lg font-bold disabled:opacity-50">
              {t`削除の予約を取り消す`}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-base text-muted">{t`ふつうは、7日後に削除する方法を使います。本人にメールで知らせ、本人は異議を送れます。その間は、取り消せます。`}</p>
            <button type="button" disabled={busy} onClick={() => void run(() => listRequest<{ item?: ListItem }>("POST", `users/${id}/deletion-request`), t`7日後の削除を予約し、本人に知らせました。`)} className="tap-target w-fit rounded-full border-2 border-danger px-6 text-lg font-bold text-danger disabled:opacity-50">
              {t`7日後に削除する`}
            </button>
          </div>
        )}
        <div className="mt-2 flex flex-col gap-3 border-t-2 border-line pt-4">
          <p className="text-base text-muted">{t`テスト用のアカウントなどは、今すぐ消せます。元に戻せません。スタンプ・コメント・ログインの情報もすべて消えます。`}</p>
          <Field label={t`確認のため、会員番号（${memberId}）を入れてください`} htmlFor="delete-now-confirm">
            <TextInput id="delete-now-confirm" value={confirm} onChange={setConfirm} maxLength={20} />
          </Field>
          <button
            type="button"
            disabled={busy || confirm.trim() !== memberId}
            onClick={() => void run(() => listRequest<{ item?: ListItem }>("DELETE", `users/${id}`), t`削除しました。`, () => router.push("/admin/users"))}
            className="tap-target w-fit rounded-full bg-danger px-6 text-lg font-bold text-paper disabled:opacity-50"
          >
            {t`今すぐ削除する`}
          </button>
        </div>
      </Section>
      {dialog}
    </>
  );
}
