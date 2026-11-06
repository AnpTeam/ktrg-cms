"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { errorKeyFromApi, isServerCode, type ErrorKey } from "@/lib/api-error";
import { hasFastStart, MAX_VIDEO_BYTES, sniffVideo } from "@/lib/admin/video-file";

type Sent = { ok: true; url: string; fastStart: boolean } | { ok: false; key: ErrorKey };

/** PUT the file to the signed address, reporting progress (fetch cannot). */
function put(uploadUrl: string, file: File, type: string, onProgress: (share: number) => void): Promise<boolean> {
  return new Promise((done) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => done(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => done(false);
    xhr.onabort = () => done(false);
    xhr.send(file);
  });
}

/**
 * A video goes in two steps, because the host will not take a big request: POST /admin/uploads/video signs an address,
 * then the browser sends the file straight to the storage. The file is checked first (MP4 or WebM by its bytes, at
 * most 200 MB); a missing "fast start" is only reported, since the video still plays.
 */
async function uploadVideo(file: File, onProgress: (share: number) => void): Promise<Sent> {
  if (file.size === 0 || file.size > MAX_VIDEO_BYTES) return { ok: false, key: "invalid_file" };
  const kind = sniffVideo(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!kind) return { ok: false, key: "invalid_file" };
  try {
    const res = await fetch("/api/v1/admin/uploads/video", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: file.name, contentType: kind.type, size: file.size }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; upload?: { url?: unknown; uploadUrl?: unknown } } | null;
    const upload = json?.upload;
    if (!res.ok || json?.ok !== true || typeof upload?.url !== "string" || typeof upload.uploadUrl !== "string") {
      return { ok: false, key: json?.ok === false && isServerCode(json.error) ? json.error : errorKeyFromApi(res.status, json) };
    }
    if (!(await put(upload.uploadUrl, file, kind.type, onProgress))) return { ok: false, key: "network" };
    const fastStart = kind.type === "video/webm" || (await hasFastStart(file.size, async (a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer())));
    return { ok: true, url: upload.url, fastStart };
  } catch {
    return { ok: false, key: "network" };
  }
}

/** A "choose a video" button for the video link box: `onUploaded` gets the file's https link once it is in the storage. */
export function VideoUpload({ onUploaded, disabled = false }: { onUploaded: (url: string) => void; disabled?: boolean }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [slowStart, setSlowStart] = useState(false);
  const busy = percent !== null;

  async function send(file: File | undefined) {
    if (!file) return;
    setPercent(0);
    setError(null);
    setSlowStart(false);
    const res = await uploadVideo(file, (share) => setPercent(Math.round(share * 100)));
    setPercent(null);
    if (res.ok) {
      setSlowStart(!res.fastStart);
      onUploaded(res.url);
    } else setError(res.key);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="tap-target inline-flex w-fit cursor-pointer items-center rounded-full border-2 border-line px-5 text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent has-[:disabled]:opacity-40">
        {busy ? t`送っています… ${percent}%` : t`動画をアップロード`}
        <input
          type="file"
          accept="video/mp4,video/webm"
          disabled={busy || disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // the same file can be chosen again
            void send(file);
          }}
          className="sr-only"
        />
      </label>
      <p className="text-base text-muted">{t`MP4（H.264）かWebM、200MBまで。スマホで見やすいよう、書き出しは720p・1.5〜2Mbps程度（8分で100MB前後）がおすすめです。ffmpegなら：ffmpeg -i 元.mp4 -vf scale=-2:720 -c:v libx264 -b:v 1800k -c:a aac -b:a 96k -movflags +faststart 出力.mp4`}</p>
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {messages[error]}
        </p>
      ) : null}
      {slowStart ? (
        <p role="status" className="text-base font-bold">
          {t`この動画は「ファストスタート」になっていないため、再生が始まるまで時間がかかることがあります。書き出し時に「Web向けに最適化」をオンにしてください。`}
        </p>
      ) : null}
    </div>
  );
}
