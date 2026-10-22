import { useLingui } from "@lingui/react/macro";
import { CloseIcon } from "@/components/icons";
import { CreditCaption } from "@/components/PhotoCredit";
import { RoutePhoto } from "@/components/RoutePhoto";
import { plainRich } from "@/lib/rich-text";
import type { MapPhoto } from "@/lib/map-screen";

/**
 * A small card over the map for a place (a shop, a toilet, a spring ...): its photo, its name and a few words, like the photo
 * popup of a hiking map. It sits just above the sheet, so the pin it belongs to stays in view, and closes with its own button
 * or by touching the map.
 */
export function MapPopup({
  photo,
  name,
  nameLang,
  text,
  sub,
  bottomPx,
  onClose,
}: {
  photo: MapPhoto | null;
  name: string;
  nameLang: "ja" | "en";
  /** A few words about the place (cut after three lines). */
  text: string | null;
  /** A short line under the name, for example its opening hours. */
  sub: string | null;
  /** How much of the map's bottom the sheet and the tab bar cover. */
  bottomPx: number;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <section
      role="dialog"
      aria-label={name}
      style={{ bottom: bottomPx + 12 }}
      className="absolute inset-x-3 z-20 mx-auto grid max-w-md grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl bg-paper p-3 pr-12 shadow-lg"
    >
      {photo ? (
        <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-surface">
          <RoutePhoto src={photo.src} alt={photo.alt} />
        </div>
      ) : null}
      <div className={`min-w-0 ${photo ? "" : "col-span-2"}`}>
        <h3 lang={nameLang} className="text-xl font-bold leading-snug">
          {name}
        </h3>
        {sub ? <p className="mt-0.5 text-base text-muted">{sub}</p> : null}
        {text ? <p className="mt-1 line-clamp-3 text-lg leading-7">{plainRich(text)}</p> : null}
      </div>
      {photo?.credit ? <CreditCaption credit={photo.credit} className="col-span-2" /> : null}
      <button
        type="button"
        onClick={onClose}
        aria-label={t`閉じる`}
        className="absolute right-1.5 top-1.5 inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface"
      >
        <CloseIcon />
      </button>
    </section>
  );
}
