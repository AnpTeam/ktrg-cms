"use client";

import { createPortal } from "react-dom";
import { useLingui } from "@lingui/react/macro";

/**
 * A real wait (finding the phone's position, sending a stamp): the page dims and a seal ring draws itself round, with a
 * sentence saying what is happening, so the screen never looks frozen (docs/design-language.md, Motion). It shows only
 * after 300 ms (.overlay-in), so a quick answer never flashes it. Under reduced motion the ring stands complete and
 * still. The tab bar (z-40) stays above it and usable. `onCancel` adds a way out when the wait can be stopped.
 * Drawn into <body> (a portal): the stamp button sits in a sticky z-10 box, which would otherwise cap it below the page's
 * own sticky bars. Only shown after a press, so it never renders on the server.
 */
export function LoadingOverlay({ label, onCancel }: { label: string; onCancel?: () => void }) {
  const { t } = useLingui();
  return createPortal(
    <div className="overlay-in fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-paper p-6 text-center text-ink shadow-2xl">
        <svg viewBox="0 0 48 48" aria-hidden="true" className="size-16 -rotate-90">
          <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" className="stroke-line/30" />
          <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3" strokeLinecap="round" pathLength={1} className="seal-draw stroke-brand" />
        </svg>
        <p className="text-xl font-bold leading-snug">{label}</p>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="tap-target inline-flex items-center px-4 text-lg font-bold underline underline-offset-4">
            {t`やめる`}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
