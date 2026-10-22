import { useLingui } from "@lingui/react/macro";
import { CloseIcon } from "@/components/icons";

/**
 * Pins that stand on (nearly) the same spot cannot be pulled apart by zooming, so touching them opens this short list: each
 * place with its number, and a tap chooses it. Used where a station and the start of a course are at the same place.
 */
export function MapPickList({
  items,
  bottomPx,
  onPick,
  onClose,
}: {
  items: { id: string; order: number | null; name: string; nameLang: "ja" | "en" }[];
  /** How much of the map's bottom the sheet and the tab bar cover. */
  bottomPx: number;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <section role="dialog" aria-label={t`同じ場所にあるもの`} style={{ bottom: bottomPx + 12 }} className="absolute inset-x-3 z-20 mx-auto max-w-sm rounded-2xl bg-paper p-3 pr-12 shadow-lg">
      <h3 className="text-lg font-bold">{t`同じ場所にあるもの`}</h3>
      <ul className="mt-1">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onPick(item.id)} className="tap-target flex w-full items-center gap-3 border-t border-line/30 py-1 text-left text-xl font-bold">
              {item.order !== null ? <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink text-base tabular-nums">{item.order}</span> : null}
              <span lang={item.nameLang} className="min-w-0">
                {item.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose} aria-label={t`閉じる`} className="absolute right-1.5 top-1.5 inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface">
        <CloseIcon />
      </button>
    </section>
  );
}
