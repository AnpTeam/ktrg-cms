import Image from "next/image";
import { CoverWatch } from "@/components/CoverWatch";
import { CreditToggle } from "@/components/PhotoCredit";
import { Zoomable } from "@/components/Zoomable";

/**
 * The cover of a course or a stop page. In one column the photo runs edge to edge and fades into the page at the bottom,
 * and the page puts the name on the fade (`-mt-20` on its header), so photo and title read as one. In a wide container
 * (`@4xl`) it is a plain framed photo, unless `flat`: the course page keeps the phone's cover at every width.
 * `className` adds the page's own order classes.
 */
export function CoverPhoto({ photo, className = "", flat = false }: { photo: { src: string; alt: string; credit: string | null }; className?: string; flat?: boolean }) {
  return (
    // data-cover: on a phone the top bar goes see-through and this photo runs up behind it to the top of the screen; in the
    // installed app it also runs behind the Dynamic Island (globals.css).
    <div data-cover className={`relative aspect-[4/3] w-full overflow-hidden bg-surface ${flat ? "" : "@4xl:aspect-video @4xl:rounded-2xl"} ${className}`}>
      <CoverWatch />
      <Zoomable src={photo.src} alt={photo.alt}>
        <Image src={photo.src} alt={photo.alt} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" unoptimized={photo.src.startsWith("https://")} />
      </Zoomable>
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-paper ${flat ? "" : "@4xl:hidden"}`} />
      {/* In line with the back button (the top bar's row); lower only where the sample notice button holds that corner. */}
      <div className="cover-credit contents">
        <CreditToggle credit={photo.credit} />
      </div>
    </div>
  );
}
