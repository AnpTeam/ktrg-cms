"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { subtitleUrl, type FileVideo } from "@/lib/video";

/**
 * A video file from the site's own storage, in the browser's own player. Like IntroVideo it loads nothing until the
 * visitor taps it, so a long video costs no mobile data (and nothing on a weak signal) before they choose to watch.
 * After the tap the player streams the file as it plays.
 */
export function FileVideoPlayer({ video, title, subtitles = false, language = "ja", version = null }: { video: FileVideo; title: string; /** When the route was last saved: part of the subtitles' address, so replaced subtitles are fetched again. */ version?: string | null; /** The language the subtitles are in. */ language?: "ja" | "en"; /** Ask for the .vtt beside the video (only when one was uploaded). */ subtitles?: boolean }) {
  const { t } = useLingui();
  const [playing, setPlaying] = useState(false);
  // The browser's own reason when the video cannot be played (MediaError.code: 1 stopped, 2 network, 3 could not be decoded, 4 not supported); 0 when it did not say.
  const [failed, setFailed] = useState<{ code: number; message: string; network: number; ready: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-xl border-2 border-line bg-ink">
        {playing ? (
          // No download button and no right-click menu: this only stops casual saving, the file's address stays public.
          // The subtitles come from the site's own address (see subtitleUrl); a video without them simply shows none.
          <video key={attempt} src={video.src} onError={(e) => setFailed({ code: e.currentTarget.error?.code ?? 0, message: (e.currentTarget.error?.message ?? "").slice(0, 200), network: e.currentTarget.networkState, ready: e.currentTarget.readyState })} title={title} controls controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} autoPlay playsInline preload="auto" className="h-full w-full">
            {subtitles ? <track kind="subtitles" src={subtitleUrl(video, version)} srcLang={language} label={t`字幕`} default /> : null}
          </video>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="tap-target flex h-full w-full flex-col items-center justify-center gap-3 text-paper"
          >
            <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-brand text-on-brand">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
            <span className="text-xl font-bold">{t`動画を見る`}</span>
          </button>
        )}
      </div>
      {failed !== null ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-surface p-4">
          <p className="text-lg font-bold">{t`動画を再生できませんでした。（エラー ${failed.code}）`}</p>
          {/* What the browser itself reports, for whoever has to find the cause (kept small and in the browser's own words). */}
          <p className="break-all text-base text-muted">{`${failed.message || "-"} [network ${failed.network}, ready ${failed.ready}]`}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setFailed(null);
                setAttempt((n) => n + 1);
              }}
              className="tap-target rounded-xl bg-ink px-5 text-lg font-bold text-paper"
            >
              {t`もう一度ためす`}
            </button>
            <a href={video.src} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center text-lg font-bold text-accent underline underline-offset-4">
              {t`動画を直接開く`}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
