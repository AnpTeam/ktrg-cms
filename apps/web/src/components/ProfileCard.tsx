"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { AuthError, inputClass, OriginPicker, primaryButton, secondaryButton, useOriginNames } from "@/components/auth/authUi";
import { UserIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { failureFromApi, hasName, NAME_MAX, type AuthFailure, type Origin } from "@/lib/auth-flow";

/**
 * Who is signed in, at the top of the stamp page: the name and where they come from, and a button to
 * change them (saved with PATCH /me). The profile lives here, with the stamps, not in the menu.
 */
export function ProfileCard({ name, origin }: { name: string | null; origin: Origin | null }) {
  const { t } = useLingui();
  const router = useRouter();
  const originNames = useOriginNames();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name ?? "");
  const [originInput, setOriginInput] = useState<Origin | null>(origin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !hasName(nameInput)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.me.patch({ displayName: nameInput.trim(), origin: originInput });
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

  if (editing) {
    return (
      <form onSubmit={save} className="mx-4 flex flex-col gap-5 rounded-xl border-2 border-line bg-surface p-4" noValidate>
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
            }}
            className={secondaryButton}
          >
            {t`やめる`}
          </button>
        </div>
      </form>
    );
  }

  return (
    <section aria-label={t`プロフィール`} className="mx-4 flex items-center gap-4 rounded-xl border-2 border-line bg-surface p-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand [&_svg]:size-7">
        <UserIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-xl font-bold leading-snug">{name ?? t`お名前は未設定です`}</p>
        <p className="text-lg text-muted">{origin ? originNames[origin] : t`どちらからかは未設定です`}</p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tap-target shrink-0 rounded-lg border-2 border-ink px-4 text-lg font-bold hover:bg-paper"
      >
        {t`変える`}
      </button>
    </section>
  );
}
