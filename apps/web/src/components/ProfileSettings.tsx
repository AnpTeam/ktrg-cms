"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { AgeRangePicker, FoundViaPicker, GenderPicker, useAgeRangeNames, useFoundViaNames, useGenderNames } from "@/components/auth/AboutYou";
import { AuthError, inputClass, OriginPicker, primaryButton, secondaryButton, useOriginNames } from "@/components/auth/authUi";
import { useReauth } from "@/components/auth/ReauthDialog";
import { ChevronIcon } from "@/components/icons";
import { PrivacyNote } from "@/components/PrivacyNote";
import { api } from "@/lib/api";
import { requestAccountDeletion } from "@/lib/auth-client";
import { placeName } from "@/lib/origin-places";
import { failureFromApi, hasName, NAME_MAX, type AgeRange, type AuthFailure, type FoundVia, type Gender, type Origin } from "@/lib/auth-flow";
import { formatUpdated } from "@/lib/format";

type Field = "displayName" | "origin" | "ageRange" | "gender" | "foundVia";

const dangerButton = "tap-target flex min-h-12 w-full items-center justify-center rounded-full bg-danger px-6 text-xl font-bold text-paper disabled:opacity-60";
const rowBox = "tap-target flex items-center justify-between gap-3 px-4 py-3 text-left";
const row = `w-full ${rowBox}`;

/**
 * The profile page's settings, as a list like a phone's settings: each answer is a row, tapping it opens a small sheet,
 * and a choice is saved the moment it is made (PATCH /me), with a line saying so. Below: the ways to log in, and deleting
 * the account (asked about first, with a fresh login check).
 */
export function ProfileSettings({
  locale,
  deletionDueAt,
  deletionByAdmin,
  deletionAppeal,
  name,
  origin,
  originPlace,
  ageRange,
  gender,
  foundVia,
}: {
  locale: string;
  deletionDueAt: string | null;
  deletionByAdmin: boolean;
  deletionAppeal: string | null;
  name: string | null;
  origin: Origin | null;
  originPlace: string | null;
  ageRange: AgeRange | null;
  gender: Gender | null;
  foundVia: FoundVia | null;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const originNames = useOriginNames();
  const ageNames = useAgeRangeNames();
  const genderNames = useGenderNames();
  const foundViaNames = useFoundViaNames();
  const { guard, dialog: reauthDialog } = useReauth();
  const sheet = useRef<HTMLDialogElement>(null);
  const confirm = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Field | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [nameInput, setNameInput] = useState(name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [appeal, setAppeal] = useState("");

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    if (editing && !el.open) el.showModal();
    if (!editing && el.open) el.close();
  }, [editing]);
  useEffect(() => {
    const el = confirm.current;
    if (!el) return;
    if (confirming && !el.open) el.showModal();
    if (!confirming && el.open) el.close();
  }, [confirming]);

  // `close: false` keeps the sheet open: after a plain 日本 / 海外 (or 選びなおす) the next choice comes in the same sheet.
  async function save(change: Partial<Record<Field | "originPlace", string | null>>, close = true) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.me.patch(change as never);
      if (res.error) {
        const status = typeof res.error.status === "number" ? res.error.status : 0;
        setError(status === 0 ? "network" : failureFromApi(status, res.error.value));
      } else {
        if (close) setEditing(null);
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("network");
    }
    setBusy(false);
  }

  async function requestDeletion() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setConfirming(false); // so the "confirm it is you" window is not stacked on this one
    const res = await guard(requestAccountDeletion);
    if (!res.ok) setError(res.code === "cancelled" ? null : res.code);
    else router.refresh();
    setBusy(false);
  }

  async function sendAppeal() {
    if (busy || appeal.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.me.deletion.appeal.post({ message: appeal.trim() });
      if (res.error) setError("failed");
      else {
        setAppeal("");
        router.refresh();
      }
    } catch {
      setError("network");
    }
    setBusy(false);
  }

  async function cancelDeletion() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.me.deletion.cancel.post();
      if (res.error) setError("failed");
      else router.refresh();
    } catch {
      setError("network");
    }
    setBusy(false);
  }

  const unset = t`未設定`;
  const rows: { field: Field; label: string; value: string }[] = [
    { field: "displayName", label: t`お名前`, value: name ?? unset },
    { field: "origin", label: t`お住まい`, value: (originPlace && placeName(originPlace, locale)) || (origin ? originNames[origin] : unset) },
    { field: "ageRange", label: t`年代`, value: ageRange ? ageNames[ageRange] : unset },
    { field: "gender", label: t`性別`, value: gender ? genderNames[gender] : unset },
    { field: "foundVia", label: t`知ったきっかけ`, value: foundVia ? foundViaNames[foundVia] : unset },
  ];
  const due = deletionDueAt ? formatUpdated(locale, deletionDueAt) : "";

  // A choice in the sheet is saved at once; choosing the chosen one again clears it.
  const picker: Record<Exclude<Field, "displayName">, ReactNode> = {
    origin: <OriginPicker value={{ origin, place: originPlace }} onChange={(v) => save({ origin: v.origin, originPlace: v.place }, v.place !== null)} />,
    ageRange: <AgeRangePicker value={ageRange} onChange={(v) => save({ ageRange: v })} />,
    gender: <GenderPicker value={gender} onChange={(v) => save({ gender: v })} />,
    foundVia: <FoundViaPicker value={foundVia} onChange={(v) => save({ foundVia: v })} />,
  };

  return (
    <div className="flex flex-col gap-6">
      {deletionDueAt && deletionByAdmin ? (
        <section role="status" className="mx-4 flex flex-col gap-3 rounded-3xl border-2 border-danger p-5">
          <p className="text-xl font-bold text-danger">{t`管理者が、アカウントの削除を予約しました`}</p>
          <p className="text-lg leading-8">{t`${due}（日本時間）に、アカウントとすべての記録が消えます。異議があるときは、理由を送ってください。管理者が確認します。`}</p>
          {deletionAppeal ? <p className="whitespace-pre-line rounded-2xl bg-surface p-4 text-lg leading-8">{deletionAppeal}</p> : null}
          {deletionAppeal ? <p className="text-lg font-bold">{t`異議を受け付けました。書きなおすと、新しい内容に変わります。`}</p> : null}
          <label className="flex flex-col gap-2 text-lg font-bold">
            {t`異議の理由`}
            <textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} rows={4} maxLength={1000} className="rounded-2xl border-2 border-line bg-paper p-3 text-lg font-normal" />
          </label>
          <button type="button" disabled={busy || appeal.trim() === ""} onClick={sendAppeal} className={primaryButton}>
            {t`異議を送る`}
          </button>
        </section>
      ) : deletionDueAt ? (
        <section role="status" className="mx-4 flex flex-col gap-3 rounded-3xl border-2 border-danger p-5">
          <p className="text-xl font-bold text-danger">{t`アカウントを削除します`}</p>
          <p className="text-lg leading-8">{t`${due}（日本時間）に、アカウントとすべての記録が消えます。それまでは、取り消せます。`}</p>
          <button type="button" disabled={busy} onClick={cancelDeletion} className={primaryButton}>
            {t`削除を取り消す`}
          </button>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="mx-4 border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent">{t`プロフィール`}</h2>
        <ul className="mx-4 divide-y divide-line/30 overflow-hidden rounded-[1.75rem] bg-surface">
          {rows.map((r) => (
            <li key={r.field}>
              <button
                type="button"
                onClick={() => {
                  setNameInput(name ?? "");
                  setError(null);
                  setSaved(false);
                  setEditing(r.field);
                }}
                className={row}
              >
                <span className="text-lg font-bold">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 text-lg text-muted">
                  <span className="truncate">{r.value}</span>
                  <ChevronIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p role="status" className="mx-4 min-h-7 text-lg font-bold text-moss">{saved ? t`保存しました。` : ""}</p>
        <div className="mx-4">
          <PrivacyNote />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="mx-4 border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent">{t`ログイン`}</h2>
        <Link href="/settings/passkeys" className={`mx-4 flex items-center justify-between rounded-[1.75rem] bg-surface ${rowBox}`}>
          <span className="text-lg font-bold">{t`ログインの方法`}</span>
          <ChevronIcon />
        </Link>
      </section>

      {deletionDueAt ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="mx-4 border-l-4 border-danger pl-3 font-serif text-xl font-bold text-danger">{t`アカウントの削除`}</h2>
          <div className="mx-4 flex flex-col gap-3 rounded-3xl border-2 border-danger/40 p-4">
            <p className="text-lg leading-7">{t`アカウントと、集めたスタンプなどの記録を、すべて消します。依頼から3日のあいだは、取り消せます。`}</p>
            <button type="button" onClick={() => setConfirming(true)} className="tap-target w-full rounded-full border-2 border-danger px-4 text-lg font-bold text-danger hover:bg-paper">
              {t`アカウントを削除する`}
            </button>
          </div>
        </section>
      )}
      <AuthError code={error && !editing ? error : null} />

      <dialog
        ref={sheet}
        aria-labelledby="profile-sheet-title"
        onClose={() => setEditing(null)}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
      >
        {editing === "displayName" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (hasName(nameInput)) void save({ displayName: nameInput.trim() });
            }}
            className="flex flex-col gap-4"
            noValidate
          >
            <label className="flex flex-col gap-2 text-lg font-bold" id="profile-sheet-title">
              {t`お名前`}
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoComplete="nickname" maxLength={NAME_MAX} className={inputClass} />
            </label>
            <AuthError code={error} />
            <button type="submit" disabled={busy || !hasName(nameInput)} className={primaryButton}>
              {t`保存する`}
            </button>
          </form>
        ) : editing ? (
          <div className="flex flex-col gap-4" id="profile-sheet-title">
            {picker[editing]}
            <AuthError code={error} />
          </div>
        ) : null}
        <button type="button" onClick={() => setEditing(null)} className={`${secondaryButton} mt-4`}>
          {t`閉じる`}
        </button>
      </dialog>

      <dialog
        ref={confirm}
        aria-labelledby="delete-title"
        onClose={() => setConfirming(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
      >
        <h2 id="delete-title" className="text-2xl font-bold">
          {t`アカウントを削除しますか？`}
        </h2>
        <p className="mt-3 text-lg leading-8">{t`押すと、アカウントと、集めたスタンプなどの記録を、3日後にすべて消します。`}</p>
        <p className="mt-2 text-lg leading-8">{t`3日のあいだは、ログインして取り消せます。3日をすぎると、もとにもどせません。`}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" disabled={busy} onClick={requestDeletion} className={dangerButton}>
            {t`削除を依頼する`}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryButton}>
            {t`やめる`}
          </button>
        </div>
      </dialog>
      {reauthDialog}
    </div>
  );
}
