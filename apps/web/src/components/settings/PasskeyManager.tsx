"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLingui } from "@lingui/react/macro";
import { AuthError, primaryButton, secondaryButton } from "@/components/auth/authUi";
import { useReauth } from "@/components/auth/ReauthDialog";
import { KeyIcon } from "@/components/icons";
import { addPasskey, listPasskeys, passkeysSupported, removePasskey, type PasskeyItem } from "@/lib/auth-client";
import type { AuthFailure } from "@/lib/auth-flow";
import { formatDay } from "@/lib/format";

// A passkey is an account's face or fingerprint login on one phone. This screen lists them, adds this phone's,
// and removes one after a confirmation. The API refuses to remove the last way to log in and emails the owner.

const dangerButton =
  "tap-target flex min-h-14 w-full items-center justify-center rounded-xl bg-danger px-6 text-xl font-bold text-on-brand disabled:opacity-60";

/** The day in Japan time as YYYY-MM-DD, for `formatDay`. */
const japanDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(iso));

export function PasskeyManager({ locale }: { locale: string }) {
  const { t } = useLingui();
  const [items, setItems] = useState<PasskeyItem[] | null>(null);
  const [error, setError] = useState<AuthFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<PasskeyItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
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

      {items && items.length === 0 ? <p className="text-lg">{t`このアカウントに、パスキーはまだありません。`}</p> : null}

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
              <span className="min-w-0 flex-1">
                <span className="block break-words text-xl font-bold leading-snug">{item.label ?? t`パスキー ${number}`}</span>
                <span className="block text-lg text-muted">{t`${added} に追加`}</span>
              </span>
              <button
                type="button"
                onClick={() => setRemoving(item)}
                disabled={busy}
                className="tap-target shrink-0 rounded-lg border-2 border-danger px-4 text-lg font-bold text-danger hover:bg-paper disabled:opacity-60"
              >
                {t`消す`}
              </button>
            </li>
            );
          })}
        </ul>
      ) : null}

      <AuthError code={error} />

      {supported === true ? (
        <button type="button" onClick={add} disabled={busy} className={primaryButton}>
          {t`この端末のパスキーを追加する`}
        </button>
      ) : null}
      {supported === false ? <p className="rounded-2xl bg-surface p-4 text-lg">{t`この端末・ブラウザではパスキーを使えません。`}</p> : null}

      {reauthDialog}
      <dialog
        ref={dialog}
        aria-labelledby="remove-passkey-title"
        onClose={() => setRemoving(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60"
      >
        <h2 id="remove-passkey-title" className="text-2xl font-bold">
          {t`このパスキーを消しますか？`}
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
      </dialog>
    </div>
  );
}
