import { Zoomable } from "@/components/Zoomable";
import Image from "next/image";
import { useLingui } from "@lingui/react/macro";
import type { GalleryPhoto } from "@/lib/content";

/**
 * More photos of a place, in a row you swipe sideways. A photo that is not ours carries its credit (who took it, under
 * which license) and a link to the page it came from, as the free licenses ask.
 */
export function SpotGallery({ photos, alt }: { photos: GalleryPhoto[]; alt: string }) {
  const { t } = useLingui();
  return (
    <ul aria-label={t`写真`} className="-mx-0 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" tabIndex={0}>
      {photos.map((p) => (
        <li key={p.url} className="w-72 shrink-0 snap-start">
          <figure className="flex flex-col gap-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface">
              <Zoomable src={p.url} alt={alt}>
                <Image src={p.url} alt={alt} fill sizes="18rem" className="object-cover" unoptimized />
              </Zoomable>
            </div>
            {p.credit ? (
              <figcaption className="text-base text-muted">
                {p.sourceUrl ? (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {p.credit}
                  </a>
                ) : (
                  p.credit
                )}
              </figcaption>
            ) : null}
          </figure>
        </li>
      ))}
    </ul>
  );
}
