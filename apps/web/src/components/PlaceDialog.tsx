"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { PlaceCard } from "@/components/map/PlacesPanel";
import type { MapPlace } from "@/lib/places";
import { buttonStyle } from "@/components/button";

/**
 * A place in a small window over the page (a place has no page of its own): its details, and, when it is on the big map,
 * a link that shows it there. `place` null keeps the window shut.
 */
export function PlaceDialog({ place, mapHref, meters = null, onClose }: { place: MapPlace | null; mapHref: string | null; meters?: number | null; onClose: () => void }) {
  const { t } = useLingui();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (place && !d.open) d.showModal();
    if (!place && d.open) d.close();
  }, [place]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border-2 border-ink bg-paper p-3 text-ink backdrop:bg-black/60">
      {place ? (
        <div className="flex flex-col gap-3">
          <PlaceCard place={place} meters={meters} onClose={onClose} />
          {mapHref ? (
            <Link href={mapHref} className={buttonStyle("primary", "md", "flex")}>
              {t`地図で見る`}
            </Link>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
