"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import type { MapPhoto } from "@/lib/map-screen";

/**
 * The top of a course's or a stop's sheet: its photo as a banner, with the name written over it (and a way back
 * in the corner). With no photo the same banner is a deep red panel, so every course looks the same. The text sits on
 * a dark fade at the foot of the picture, so it stays readable on any photo; those colours are fixed (white on dark),
 * like the route line, and do not change with the theme.
 */
export function SheetHero({
  photo,
  title,
  lang,
  eyebrow,
  backLabel,
  backLang,
  onBack,
}: {
  photo: MapPhoto | null;
  title: string;
  lang: "ja" | "en";
  /** A small line above the title: where the course is, or which course a stop belongs to. */
  eyebrow: ReactNode;
  backLabel: string;
  backLang?: "ja" | "en";
  onBack: () => void;
}) {
  return (
    <div className="relative mx-4 aspect-[16/10] overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, #6f241c, #b04a40)" }}>
      {photo ? <Image src={photo.src} alt="" fill sizes="(min-width: 1280px) 21rem, 100vw" className="object-cover" unoptimized={photo.src.startsWith("https://")} /> : null}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
      <button
        type="button"
        onClick={onBack}
        className="tap-target absolute left-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-black/60 py-1 pl-2 pr-4 text-lg font-bold text-white"
      >
        <ChevronLeftIcon />
        <span lang={backLang} className="truncate">
          {backLabel}
        </span>
      </button>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)]">
        {eyebrow ? <p className="text-lg leading-snug">{eyebrow}</p> : null}
        {/* Headings are red by default; on the banner the title is white. */}
        <h2 lang={lang} className="text-3xl font-bold leading-tight text-white">
          {title}
        </h2>
      </div>
      {photo ? <span className="sr-only">{photo.alt}</span> : null}
    </div>
  );
}

/** The photos of a course in a row you swipe sideways (and scroll with the arrow keys). */
export function Gallery({ photos, label }: { photos: MapPhoto[]; label: string }) {
  return (
    <ul aria-label={label} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2" tabIndex={0}>
      {photos.map((p) => (
        <li key={p.src} className="relative aspect-[4/3] w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface">
          <Image src={p.src} alt={p.alt} fill sizes="16rem" className="object-cover" unoptimized={p.src.startsWith("https://")} />
        </li>
      ))}
    </ul>
  );
}
