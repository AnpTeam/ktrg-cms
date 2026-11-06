"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { AuthError, inputClass, primaryButton, secondaryButton } from "@/components/auth/authUi";
import { buttonStyle } from "@/components/button";
import { useReauth } from "@/components/auth/ReauthDialog";
import { KeyIcon } from "@/components/icons";
import { addPasskey, listPasskeys, renamePasskey, passkeysSupported, removePasskey, type PasskeyItem } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";
import { formatDay, japanDay } from "@/lib/format";

// A passkey is an account's face or fingerprint login on one phone. This screen lists them, adds this phone's,
// and removes one after a confirmation. The API refuses to remove the last way to log in and emails the owner.

const dangerButton =
  "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-danger px-6 text-xl font-bold text-on-brand disabled:opacity-60";

export function PasskeyManager({ locale, hasEmail }: { locale: string; hasEmail: boolean }) {
  const { t } = useLingui();
  const [items, setItems] = useState<PasskeyItem[] | null>(null);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<PasskeyItem | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // The server refuses it too; saying so before asking "are you sure" saves a confirm-it-is-you step for nothing.
  const lastWay = !hasEmail && items !== null && items.length <= 1;
  const { guard, dialog: reauthDialog } = useReauth();
  // Known only in the browser, so it starts unknown (the server render and the first browser render must match).
  const supported = useSyncExternalStore(
    () => () => {},
    () => passkeysSupported(),
    () => null,
  );

  const load = useCallback(async () => {
    const res = await listPasskeys();
    if (res.ok) {
      setItems(res.passkeys);
    } else {
      setError(res.code);
    }
  }, []);

  useEffect(() => {
    let current = true;
    void listPasskeys().then((res) => {
      if (!current) return;
      if (res.ok) setItems(res.passkeys);
      else setError(res.code);
    });
    return () => {
      current = false;
    };
  }, []);

  // The confirmation is a native modal dialog: focus is trapped in it and Escape closes it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (removing && !el.open) el.showModal();
    if (!removing && el.open) el.close();
  }, [removing]);

  async function add() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await guard(addPasskey);
    if (!res.ok) setError(res.code === "cancelled" ? null : res.code);
    else await load();
    setBusy(false);
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (busy || !renaming || !renaming.label.trim()) return;
    setBusy(true);
    setError(null);
    const res = await renamePasskey(renaming.id, renaming.label.trim());
    if (res.ok) {
      setRenaming(null);
      await load();
    } else setError(res.code);
    setBusy(false);
  }

  async function confirmRemove() {
    if (busy || !removing) return;
    setBusy(true);
    setError(null);
    const id = removing.id;
    // Close the confirmation first, so the "confirm it is you" window is not stacked on it.
    setRemoving(null);
    const res = await guard(() => removePasskey(id));
    if (!res.ok) setError(res.code === "cancelled" ? null : res.code);
    else await load();
    setBusy(false);
  }


  return (
    <div className="flex flex-col gap-5">
      {items === null && !error ? (
        <p role="status" className="text-lg text-muted">
          {t`読み込み中`}
        </p>
      ) : null}

      {items && items.length === 0 ? <p className="text-lg">{t`このアカウントでは、顔・指紋のログインをまだ使っていません。`}</p> : null}

      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const number = index + 1;
            const added = formatDay(locale, japanDay(item.createdAt));
            return (
            <li key={item.id} className="flex items-center gap-4 rounded-3xl bg-surface p-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand [&_svg]:size-6">
                <KeyIcon />
              </span>
              {renaming?.id === item.id ? (
                <form onSubmit={saveName} className="flex min-w-0 flex-1 flex-col gap-2">
                  <label className="sr-only" htmlFor="passkey-name">{t`端末の名前`}</label>
                  <input
                    id="passkey-name"
                    value={renaming.label}
                    onChange={(e) => setRenaming({ id: item.id, label: e.target.value })}
                    maxLength={64}
                    autoFocus
                    className={inputClass}
                  />
                  <span className="flex gap-2">
                    <button type="submit" disabled={busy || !renaming.label.trim()} className={primaryButton}>
                      {t`保存する`}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setRenaming(null)} className={secondaryButton}>
                      {t`やめる`}
                    </button>
                  </span>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xl font-bold leading-snug">{item.label ?? t`顔・指紋のログイン ${number}`}</span>
                    <span className="block text-lg text-muted">{t`${added} に追加`}</span>
                    <button
                      type="button"
                      onClick={() => setRenaming({ id: item.id, label: item.label ?? "" })}
                      disabled={busy}
                      className="tap-target mt-1 text-lg font-bold text-accent underline underline-offset-4"
                    >
                      {t`名前を変える`}
                    </button>
                  </span>
                  <button
                type="button"
                onClick={() => setRemoving(item)}
                disabled={busy}
                className="tap-target shrink-0 rounded-lg border-2 border-danger px-4 text-lg font-bold text-danger hover:bg-paper disabled:opacity-60"
              >
                    {t`消す`}
                  </button>
                </>
              )}
            </li>
            );
          })}
        </ul>
      ) : null}

      <AuthError code={error} />

      {supported === true ? (
        <button type="button" onClick={add} disabled={busy} className={primaryButton}>
          {t`顔・指紋のログインを追加する`}
        </button>
      ) : null}
      {supported === true ? <p className="text-base text-muted">{t`ほかのパスキーアプリを使うときは、表示される画面で選んでください。`}</p> : null}
      {supported === false ? <p className="rounded-2xl bg-surface p-4 text-lg">{t`この端末では、顔・指紋のログインを使えません。`}</p> : null}

      {reauthDialog}
      <dialog
        ref={dialog}
        aria-labelledby="remove-passkey-title"
        onClose={() => setRemoving(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
      >
        {lastWay ? (
          <>
            <h2 id="remove-passkey-title" className="text-2xl font-bold">
              {t`このログインは、消せません`}
            </h2>
            <p className="mt-3 text-lg leading-8">{t`これが、このアカウントに入るための、ただ一つの方法です。消すと、ログインできなくなります。先に、メールアドレスを追加するか、別の端末の顔・指紋のログインを追加してください。`}</p>
            <div className="mt-6">
              <button type="button" onClick={() => setRemoving(null)} className={buttonStyle("primary", "lg", "flex w-full")}>
                {t`わかりました`}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="remove-passkey-title" className="text-2xl font-bold">
              {t`この顔・指紋のログインを消しますか？`}
            </h2>
            <p className="mt-3 text-lg leading-8">{t`消すと、その端末では、顔や指紋でログインできなくなります。ほかにログインの方法があるときだけ、消せます。`}</p>
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" disabled={busy} onClick={confirmRemove} className={dangerButton}>
                {t`消す`}
              </button>
              <button type="button" disabled={busy} onClick={() => setRemoving(null)} className={secondaryButton}>
                {t`やめる`}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
