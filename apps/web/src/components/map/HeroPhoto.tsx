"use client";

import Image from "next/image";
import { useLingui } from "@lingui/react/macro";
import type { MapPhoto } from "@/lib/map-screen";

/**
 * The picture at the top of a course or a stop (a photo of the place), in a 16:9 frame so the page does not jump
 * when it loads. With no photo it shows a plain "photo coming" frame in development and nothing at all in
 * production. Photos come from the CMS (a path or an address); until image storage exists (WBS 2.3.5) none do, and
 * only paths inside this site work (an outside address must first be allowed in next.config.ts).
 */
export function HeroPhoto({ photo, placeholder }: { photo: MapPhoto | null; placeholder: boolean }) {
  const { t } = useLingui();
  if (!photo && !placeholder) return null;
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-surface">
      {photo ? (
        <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1280px) 21rem, 100vw" className="object-cover" />
      ) : (
        <p className="absolute inset-0 grid place-items-center text-lg text-muted">{t`写真（準備中）`}</p>
      )}
    </div>
  );
}
