"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { CreditCaption } from "@/components/PhotoCredit";
import type { MapPhoto } from "@/lib/map-screen";

/**
 * The top of a course's or a stop's sheet, in the look of a route page's cover: the photo runs to the sheet's edges and fades
 * into the page, and the name sits on the fade. With no photo the same banner is a deep red panel, so every course looks the same.
 */
export function SheetHero({
  photo,
  title,
  lang,
  eyebrow,
  backLabel,
  onBack,
}: {
  photo: MapPhoto | null;
  title: string;
  lang: "ja" | "en";
  /** A small line under the title: where the course is, or which course a stop belongs to. */
  eyebrow: ReactNode;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "linear-gradient(135deg, #6f241c, #b04a40)" }}>
        {photo ? <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 26rem, 100vw" className="object-cover" unoptimized={photo.src.startsWith("https://")} /> : null}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-paper" />
        {/* Below the sheet's handle on a phone; a desktop panel has none. */}
        <button
          type="button"
          onClick={onBack}
          className="tap-target absolute left-3 top-[calc(3.75rem+var(--sheet-top,0px))] inline-flex items-center gap-1 rounded-full bg-black/60 py-1 pl-2 pr-4 text-lg font-bold text-white lg:top-3"
        >
          <ChevronLeftIcon />
          {backLabel}
        </button>
        {photo ? <span className="sr-only">{photo.alt}</span> : null}
      </div>
      <div className="relative -mt-20 px-4">
        {/* The page's one h1 while a course or stop is chosen (the home header, which has it otherwise, is not drawn then). */}
        <h1 lang={lang} className="text-3xl font-bold leading-tight">
          {title}
        </h1>
        {eyebrow ? <p className="mt-2 text-lg leading-snug text-muted">{eyebrow}</p> : null}
      </div>
      <CreditCaption credit={photo?.credit} className="mx-4 mt-2" />
    </div>
  );
}

/** The photos of a course in a row you swipe sideways (and scroll with the arrow keys). */
export function Gallery({ photos, label }: { photos: MapPhoto[]; label: string }) {
  return (
    <ul aria-label={label} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2" tabIndex={0}>
      {photos.map((p) => (
        <li key={p.src} className="w-64 shrink-0 snap-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface">
            <Image src={p.src} alt={p.alt} fill sizes="16rem" className="object-cover" unoptimized={p.src.startsWith("https://")} />
          </div>
          <CreditCaption credit={p.credit} className="mt-2" />
        </li>
      ))}
    </ul>
  );
}
