"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { AgeRangePicker, GenderPicker, useAgeRangeNames, useGenderNames } from "@/components/auth/AboutYou";
import { AuthError, inputClass, OriginPicker, primaryButton, secondaryButton, useOriginNames } from "@/components/auth/authUi";
import { UserIcon } from "@/components/icons";
import { PrivacyNote } from "@/components/PrivacyNote";
import { api } from "@/lib/api";
import { formatUpdated } from "@/lib/format";
import { failureFromApi, formatPublicId, hasName, NAME_MAX, type AgeRange, type AuthFailure, type Gender, type Origin } from "@/lib/auth-flow";

/**
 * Who is signed in, at the top of the stamp page: the name and where they come from, and a button to
 * change them (saved with PATCH /me). The profile lives here, with the stamps, not in the menu.
 */
// A button that does something that cannot be undone after the grace period: red, never the brand colour.
const dangerButton =
  "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-danger px-6 text-xl font-bold text-on-brand disabled:opacity-60";

export function ProfileCard({
  publicId,
  deletionDueAt,
  locale,
  name,
  origin,
  ageRange,
  gender,
}: {
  publicId: string | null;
  /** When a requested deletion will happen (ISO time); null with no request. */
  deletionDueAt: string | null;
  locale: string;
  name: string | null;
  origin: Origin | null;
  ageRange: AgeRange | null;
  gender: Gender | null;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const originNames = useOriginNames();
  const ageNames = useAgeRangeNames();
  const genderNames = useGenderNames();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name ?? "");
  const [originInput, setOriginInput] = useState<Origin | null>(origin);
  const [ageInput, setAgeInput] = useState<AgeRange | null>(ageRange);
  const [genderInput, setGenderInput] = useState<Gender | null>(gender);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  // The confirmation is a native modal dialog: focus is trapped in it and Escape closes it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (confirming && !el.open) el.showModal();
    if (!confirming && el.open) el.close();
  }, [confirming]);

  async function requestDeletion() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.me.delete();
      if (res.error) {
        const status = typeof res.error.status === "number" ? res.error.status : 0;
        setError(status === 0 ? "network" : failureFromApi(status, res.error.value));
        setConfirming(false);
        setBusy(false);
        return;
      }
      setConfirming(false);
      setEditing(false);
      router.refresh();
    } catch {
      setError("network");
      setConfirming(false);
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

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !hasName(nameInput)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.me.patch({ displayName: nameInput.trim(), origin: originInput, ageRange: ageInput, gender: genderInput });
      if (res.error) {
        const status = typeof res.error.status === "number" ? res.error.status : 0;
        setError(status === 0 ? "network" : failureFromApi(status, res.error.value));
        setBusy(false);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("network");
    }
    setBusy(false);
  }

  const due = deletionDueAt ? formatUpdated(locale, deletionDueAt) : "";

  const confirmDialog = (
    <dialog
      ref={dialog}
      aria-labelledby="delete-title"
      onClose={() => setConfirming(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
    >
      <h2 id="delete-title" className="text-2xl font-bold">
        {t`アカウントを削除しますか？`}
      </h2>
      <p className="mt-3 text-lg leading-8">
        {t`押すと、アカウントと、集めたスタンプなどの記録を、3日後にすべて消します。`}
      </p>
      <p className="mt-2 text-lg leading-8">{t`3日のあいだは、ログインして取り消せます。3日をすぎると、もとにもどせません。`}</p>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" disabled={busy} onClick={requestDeletion} className={`${dangerButton}`}>
          {t`削除を依頼する`}
        </button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryButton}>
          {t`やめる`}
        </button>
      </div>
    </dialog>
  );

  if (editing) {
    return (
      <>
        <form onSubmit={save} className="mx-4 flex flex-col gap-5 rounded-3xl bg-surface p-5" noValidate>
          <label className="flex flex-col gap-2 text-lg font-bold">
            {t`お名前`}
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoComplete="nickname"
              autoFocus
              maxLength={NAME_MAX}
              className={inputClass}
            />
          </label>
          <OriginPicker value={originInput} onChange={setOriginInput} />
          <AgeRangePicker value={ageInput} onChange={setAgeInput} />
          <GenderPicker value={genderInput} onChange={setGenderInput} />
          <PrivacyNote />
          <AuthError code={error} />
          <div className="flex flex-col gap-3">
            <button type="submit" disabled={busy || !hasName(nameInput)} className={primaryButton}>
              {t`保存する`}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
                setNameInput(name ?? "");
                setOriginInput(origin);
                setAgeInput(ageRange);
                setGenderInput(gender);
              }}
              className={secondaryButton}
            >
              {t`やめる`}
            </button>
          </div>

          {/* Deleting the account is one tap away from editing, but needs a confirmation. */}
          <div className="border-t border-line/30 pt-5">
            {deletionDueAt ? (
              <p className="text-lg text-muted">{t`アカウントの削除を依頼ずみです。`}</p>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="tap-target w-full rounded-xl border-2 border-danger px-4 text-lg font-bold text-danger hover:bg-paper"
              >
                {t`アカウントを削除する`}
              </button>
            )}
          </div>
        </form>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      {deletionDueAt ? (
        <section role="status" className="mx-4 mb-3 flex flex-col gap-3 rounded-3xl border-2 border-danger p-5">
          <p className="text-xl font-bold text-danger">{t`アカウントを削除します`}</p>
          <p className="text-lg leading-8">{t`${due}（日本時間）に、アカウントとすべての記録が消えます。それまでは、取り消せます。`}</p>
          <AuthError code={error} />
          <button type="button" disabled={busy} onClick={cancelDeletion} className={primaryButton}>
            {t`削除を取り消す`}
          </button>
        </section>
      ) : null}
      <section aria-label={t`プロフィール`} className="mx-4 flex items-center gap-4 rounded-3xl bg-surface p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand [&_svg]:size-7">
          <UserIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-bold leading-snug">{name ?? t`お名前は未設定です`}</p>
          <p className="text-lg text-muted">{origin ? originNames[origin] : t`どちらからかは未設定です`}</p>
          {ageRange || gender ? (
            <p className="text-lg text-muted">
              {ageRange ? ageNames[ageRange] : null}
              {ageRange && gender ? "　" : null}
              {gender ? genderNames[gender] : null}
            </p>
          ) : null}
          {publicId ? <p className="mt-1 text-base text-muted">{t`ID: ${formatPublicId(publicId)}`}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="tap-target shrink-0 rounded-lg border-2 border-ink px-4 text-lg font-bold hover:bg-paper"
        >
          {t`変える`}
        </button>
      </section>
    </>
  );
}
