"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { EmbedVideo } from "@/lib/video";

/**
 * A video that loads nothing until the visitor taps it: no request to YouTube, no cookies, and no data
 * used on a weak signal before they choose. After the tap the embed replaces the button; a plain link to the
 * video's own page stays underneath for when the embed cannot load.
 */
export function IntroVideo({ video, title }: { video: EmbedVideo; title: string }) {
  const { t } = useLingui();
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden rounded-xl border-2 border-line bg-ink">
        {playing ? (
          <iframe
            src={`${video.embedUrl}${video.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full"
          />
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
      <a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center text-lg font-bold underline">
        {t`動画のページをひらく`}
      </a>
    </div>
  );
}
