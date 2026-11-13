"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";
import { PhotoLibraryButton } from "./PhotoLibrary";
import { readJson } from "@/lib/read-json";

/** The longest side a site photo needs, in pixels (a phone photo is often 4000 or more). */
const MAX_SIDE = 2400;

/**
 * The photo as a smaller JPEG: at most MAX_SIDE on its longest side. A phone photo of 5 to 10 MB would be refused by the
 * host (it rejects a body over about 4.5 MB before the API sees it), and the new copy also carries no camera data (where
 * and when it was taken). If the browser cannot read the picture, the file is sent as it is and the API decides.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file); // turned upright by its camera data, which is then left behind
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // a transparent PNG would turn black as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.88));
    return blob && blob.size > 0 ? new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Send a photo to POST /admin/uploads; its public https link, or why not. */
export async function uploadPhoto(original: File): Promise<{ ok: true; url: string } | { ok: false; key: ErrorKey }> {
  try {
    const file = await shrinkPhoto(original);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/v1/admin/uploads", { method: "POST", credentials: "same-origin", body: form });
    const json = await readJson<{ ok?: unknown; error?: unknown; upload?: { url?: unknown } }>(res);
    if (res.ok && json?.ok === true && typeof json.upload?.url === "string") return { ok: true, url: json.upload.url };
    return { ok: false, key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
  } catch {
    return { ok: false, key: "network" };
  }
}

/**
 * A "choose a photo" button for the box next to it: the file goes to the photo storage and `onUploaded` gets its https link.
 * Beside it, a button for the photo library: a photo uploaded before can be picked again instead of uploaded twice.
 */
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
      <div className="flex flex-wrap gap-2">
        <label className="tap-target inline-flex w-fit cursor-pointer items-center rounded-full border border-line px-5 text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent has-[:disabled]:opacity-40">
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
        <PhotoLibraryButton onPicked={onUploaded} disabled={busy || disabled} />
      </div>
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {messages[error]}
        </p>
      ) : null}
    </div>
  );
}
