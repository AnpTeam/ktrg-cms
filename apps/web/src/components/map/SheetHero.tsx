"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { CreditCaption } from "@/components/PhotoCredit";
import type { MapPhoto } from "@/lib/map-screen";

/**
 * The top of a course's or a stop's sheet: the photo runs to the sheet's edges and darkens towards its foot, where the name sits
 * in white. With no photo the same banner is a deep red panel, so every course looks the same.
 */
export function SheetHero({
  short = false,
  photo,
  title,
  lang,
  eyebrow,
  backLabel,
  onBack,
}: {
  /** Lower, for a sheet whose buttons must be in view at half height. */
  short?: boolean;
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
      {/* It grows with its words, so a long name never runs under the back button. */}
      <div
        // With no photo: the night ground with the 七宝 pattern, in both themes.
        className={`pattern-shippo pattern-on-night relative flex flex-col justify-end bg-night pt-[calc(7.25rem+var(--sheet-top,0px))] wide:pt-16 ${short ? "aspect-[2/1]" : "aspect-[4/3]"}`}
      >
        {photo ? <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 26rem, 100vw" className="object-cover" unoptimized={photo.src.startsWith("https://")} /> : null}
        {/* Dark under the words, so white reads on any photo. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-b from-transparent to-black/80" />
        {/* Below the sheet's handle on a phone; a desktop panel has none. */}
        <button
          type="button"
          onClick={onBack}
          className="tap-target absolute left-3 top-[calc(3.75rem+var(--sheet-top,0px))] inline-flex items-center gap-1 rounded-full bg-black/60 py-1 pl-2 pr-4 text-lg font-bold text-white wide:top-3"
        >
          <ChevronLeftIcon />
          {backLabel}
        </button>
        {photo ? <span className="sr-only">{photo.alt}</span> : null}
        <div className="relative px-4 pb-3 text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">
          {/* The page's one h1 while a course or stop is chosen (the home header, which has it otherwise, is not drawn then). */}
          <h1 lang={lang} className="text-3xl font-bold leading-tight text-white">
            {title}
          </h1>
          {eyebrow ? <p className="mt-1 text-lg leading-snug">{eyebrow}</p> : null}
        </div>
      </div>
      <CreditCaption credit={photo?.credit} className="mx-4 mt-2" />
    </div>
  );
}
