import { useId } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";

/**
 * A small "i" beside a label that opens a short explanation with a "Learn more" link. It uses the browser's own popover (it
 * opens over the page, centred, so it never runs off a narrow screen or is cut by a card; a tap outside or Escape closes it),
 * so it needs no script. Not for use inside a link.
 */
export function InfoTip({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  const { t } = useLingui();
  const id = useId();
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={label}
        // The ring is 20 px; the invisible ::before makes the tap area 44 px.
        className="relative ml-1 -my-1.5 inline-flex size-5 min-h-0 min-w-0 cursor-pointer before:absolute before:-inset-3 before:content-[''] items-center justify-center rounded-full p-0 align-middle text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v6" />
          <circle cx="12" cy="7.4" r="0.6" fill="currentColor" />
        </svg>
      </button>
      <div id={id} popover="auto" className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-2 border-ink bg-paper p-5 text-base font-normal leading-7 text-ink shadow-2xl backdrop:bg-black/40">
        <p className="mb-3">{children}</p>
        <Link href={href} className="font-bold text-accent underline underline-offset-4">
          {t`くわしく見る`}
        </Link>
      </div>
    </>
  );
}
