"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { FileVideo } from "@/lib/video";

/**
 * A video file from the site's own storage, in the browser's own player. Like IntroVideo it loads nothing until the
 * visitor taps it, so a long video costs no mobile data (and nothing on a weak signal) before they choose to watch.
 * After the tap the player streams the file as it plays; a plain link to the file stays underneath for when it
 * cannot play.
 */
export function FileVideoPlayer({ video, title }: { video: FileVideo; title: string }) {
  const { t } = useLingui();
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-xl border-2 border-line bg-ink">
        {playing ? (
          <video src={video.src} title={title} controls autoPlay playsInline preload="auto" className="h-full w-full" />
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
      <a href={video.src} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center text-lg font-bold underline">
        {t`動画のページをひらく`}
      </a>
    </div>
  );
}
