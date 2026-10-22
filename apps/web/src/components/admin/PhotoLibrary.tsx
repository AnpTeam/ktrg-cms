"use client";

import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";

interface LibraryPhoto {
  key: string;
  url: string;
  size: number;
  uploadedAt: string;
}

type Loaded = { state: "loading" } | { state: "ready"; photos: LibraryPhoto[] } | { state: "error"; key: ErrorKey };

/** GET /admin/uploads: every photo uploaded so far, newest first. */
async function fetchLibrary(): Promise<Loaded> {
  try {
    const res = await fetch("/api/v1/admin/uploads", { credentials: "same-origin" });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; photos?: unknown } | null;
    if (res.ok && json?.ok === true && Array.isArray(json.photos)) return { state: "ready", photos: json.photos as LibraryPhoto[] };
    return { state: "error", key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
  } catch {
    return { state: "error", key: "network" };
  }
}

/**
 * A button that opens the photo library: the photos already uploaded to the site, so an editor can pick one again
 * instead of uploading it twice. `onPicked` gets the photo's https link, the same as an upload does.
 */
export function PhotoLibraryButton({ onPicked, disabled = false }: { onPicked: (url: string) => void; disabled?: boolean }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="tap-target inline-flex w-fit items-center rounded-xl border-2 border-line px-5 text-lg font-bold disabled:opacity-40"
      >
        {t`アップロード済みの写真から選ぶ`}
      </button>
      {open ? (
        <PhotoLibraryDialog
          onClose={() => setOpen(false)}
          onPick={(url) => {
            setOpen(false);
            onPicked(url);
          }}
        />
      ) : null}
    </>
  );
}

/** A native <dialog>, so focus, Escape and the backdrop come for free. Mounted only while open, so the list is fetched fresh each time. */
function PhotoLibraryDialog({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const ref = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    let current = true;
    void fetchLibrary().then((result) => {
      if (current) setLoaded(result);
    });
    return () => {
      current = false;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="photo-library-title"
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border-2 border-ink bg-paper p-5 text-ink backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="photo-library-title" className="text-xl font-bold">
          {t`写真ライブラリ`}
        </h2>
        <button type="button" onClick={() => ref.current?.close()} className="tap-target rounded-xl border-2 border-line px-5 text-lg font-bold">
          {t`閉じる`}
        </button>
      </div>
      <p className="mt-2 text-base text-muted">{t`アップロード済みの写真です。選ぶと、その写真のリンクが入ります。`}</p>

      {loaded.state === "loading" ? <p className="mt-4 text-lg">{t`読み込んでいます…`}</p> : null}
      {loaded.state === "error" ? (
        <p role="alert" className="mt-4 text-base font-bold text-danger">
          {messages[loaded.key]}
        </p>
      ) : null}
      {loaded.state === "ready" && loaded.photos.length === 0 ? <p className="mt-4 text-lg">{t`まだ写真がありません。`}</p> : null}
      {loaded.state === "ready" && loaded.photos.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {loaded.photos.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onPick(p.url)}
                className="block w-full overflow-hidden rounded-xl border-2 border-line text-left focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail of a file in the photo bucket */}
                <img src={p.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full object-cover" />
                <span className="block truncate px-2 py-1 text-base">{p.key.replace(/^photos\//, "")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </dialog>
  );
}
