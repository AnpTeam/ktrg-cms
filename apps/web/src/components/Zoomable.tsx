"use client";

import { useRef, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { XIcon } from "@/components/icons";

/**
 * A photo you can tap to see large: `children` is the photo as the page draws it (inside a positioned box), and a tap opens
 * the whole picture over a dark screen. A native modal <dialog>: Escape and the back of the screen close it, focus stays
 * inside, and pinch to zoom works as on any page. Nothing is loaded twice: the large view uses the same address.
 */
export function Zoomable({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  const { t } = useLingui();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="absolute inset-0 block size-full cursor-zoom-in">
        {children}
        <span className="sr-only">{t`写真を大きく見る`}</span>
      </button>
      {/* A tap anywhere closes it, the photo too: one easy way out for everyone. */}
      <dialog
        ref={dialog}
        onClick={() => dialog.current?.close()}
        aria-label={alt || t`写真`}
        // Black and white in both themes, not colour tokens: a photo reads best on black, and dark mode would swap paper and ink.
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0"
      >
        <div className="flex h-full flex-col p-3">
          <div className="flex justify-end">
            <button type="button" aria-label={t`閉じる`} className="tap-target grid size-12 place-items-center rounded-full bg-white text-black">
              <XIcon size={24} />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- the same address as the photo on the page, shown whole */}
          <img src={src} alt={alt} className="min-h-0 w-full flex-1 object-contain" />
        </div>
      </dialog>
    </>
  );
}
