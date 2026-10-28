"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";
import { MAX_SUBTITLE_BYTES, toVtt } from "@/lib/admin/subtitles";

type Sent = { ok: true } | { ok: false; key: ErrorKey };

/** Reads an .srt or .vtt, makes WebVTT of it, and puts it beside the video (the API signs the address; the browser sends it). */
async function uploadSubtitles(file: File, videoUrl: string): Promise<Sent> {
  if (file.size === 0 || file.size > MAX_SUBTITLE_BYTES) return { ok: false, key: "invalid_file" };
  const vtt = toVtt(await file.text());
  if (!vtt) return { ok: false, key: "invalid_file" };
  const body = new Blob([vtt], { type: "text/vtt" });
  try {
    const res = await fetch("/api/v1/admin/uploads/subtitles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoUrl, size: body.size }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; upload?: { uploadUrl?: unknown } } | null;
    const uploadUrl = json?.upload?.uploadUrl;
    if (!res.ok || json?.ok !== true || typeof uploadUrl !== "string") {
      return { ok: false, key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
    }
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "text/vtt" }, body });
    return put.ok ? { ok: true } : { ok: false, key: "network" };
  } catch {
    return { ok: false, key: "network" };
  }
}

/** For a video uploaded to the site: a button that adds its subtitles (.srt or .vtt, in `language`). Sending again replaces them. */
export function SubtitleUpload({ videoUrl, uploaded, onUploaded, language = "ja" }: { videoUrl: string; language?: "ja" | "en"; /** Subtitles were uploaded for this video before. */ uploaded: boolean; /** They have just been uploaded: the route remembers it (saved with the route). */ onUploaded: () => void }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setDone(false);
    setError(null);
    const res = await uploadSubtitles(file, videoUrl);
    setBusy(false);
    if (res.ok) {
      setDone(true);
      onUploaded();
    }
    else setError(res.key);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="tap-target inline-flex w-fit cursor-pointer items-center rounded-xl border-2 border-line px-5 text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent has-[:disabled]:opacity-40">
        {busy ? t`送っています…` : t`字幕をアップロード（.srt / .vtt）`}
        <input
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void send(file);
          }}
          className="sr-only"
        />
      </label>
      <p className="text-base text-muted">{language === "en" ? t`英語の字幕です。もう一度送ると、置き換わります。字幕は動画の横に保存され、動画を入れ替えたときは、字幕も送りなおしてください。` : t`日本語の字幕です。もう一度送ると、置き換わります。字幕は動画の横に保存され、動画を入れ替えたときは、字幕も送りなおしてください。`}</p>
      {uploaded && !done ? <p className="text-base font-bold">{t`字幕は入っています。`}</p> : null}
      {done ? (
        <p role="status" className="text-base font-bold">
          {t`字幕を入れました。動画を再生して確かめてください。`}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {messages[error]}
        </p>
      ) : null}
    </div>
  );
}
