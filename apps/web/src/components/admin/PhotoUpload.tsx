"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";

/** Send a photo to POST /admin/uploads; its public https link, or why not. */
export async function uploadPhoto(file: File): Promise<{ ok: true; url: string } | { ok: false; key: ErrorKey }> {
  try {
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/v1/admin/uploads", { method: "POST", credentials: "same-origin", body: form });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; upload?: { url?: unknown } } | null;
    if (res.ok && json?.ok === true && typeof json.upload?.url === "string") return { ok: true, url: json.upload.url };
    return { ok: false, key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
  } catch {
    return { ok: false, key: "network" };
  }
}

/** A "choose a photo" button for the box next to it: the file goes to the photo storage and `onUploaded` gets its https link. */
export function PhotoUpload({ onUploaded, disabled = false }: { onUploaded: (url: string) => void; disabled?: boolean }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const res = await uploadPhoto(file);
    setBusy(false);
    if (res.ok) onUploaded(res.url);
    else setError(res.key);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="tap-target inline-flex w-fit cursor-pointer items-center rounded-xl border-2 border-line px-5 text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent has-[:disabled]:opacity-40">
        {busy ? t`送っています…` : t`写真をアップロード`}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // the same file can be chosen again
            void send(file);
          }}
          className="sr-only"
        />
      </label>
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {messages[error]}
        </p>
      ) : null}
    </div>
  );
}
