"use client";

import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { distanceM } from "@/lib/navigation/geometry";
import { distanceParts } from "@/lib/stamp-flow";
import { useNavigation } from "./NavigationProvider";
import { buttonStyle } from "@/components/button";

/**
 * 「ほかの場所へ向かう」: pick any stop still to stamp as the target instead of the nearest one (to skip one on purpose, or to
 * head for the one you want). A stop you stamp hands the choice back to the nearest; 「近い順にもどす」 does it by hand.
 */
export function NavTargetPicker() {
  const { t, i18n } = useLingui();
  const { session, setTarget } = useNavigation();
  const dialog = useRef<HTMLDialogElement>(null);
  if (!session) return null;
  const { snapshot: snap, model } = session;
  const left = model.stops.filter((s) => !snap.stamped.has(s.id));
  if (left.length === 0) return null;
  const fmt = new Intl.NumberFormat(i18n.locale === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 });
  const away = (s: { lat: number; lng: number }) => {
    if (!snap.position) return "";
    const d = distanceParts(distanceM(snap.position, s));
    const v = fmt.format(d.value);
    return d.unit === "km" ? t`${v}km` : t`${v}m`;
  };
  const pick = (id: string | null) => {
    setTarget(id);
    dialog.current?.close();
  };
  const row = "tap-target flex w-full items-center justify-between gap-3 rounded-full border border-ink px-4 py-2 text-left text-lg font-bold hover:bg-surface disabled:opacity-60";

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={buttonStyle("secondary", "md", "flex w-full")}>
        {snap.forcedId ? t`ほかの場所へ ✓` : t`ほかの場所へ`}
      </button>
      <dialog ref={dialog} aria-labelledby="nav-target-title" className="m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl bg-paper p-5 text-ink backdrop:bg-black/60">
        <h2 id="nav-target-title" className="text-2xl font-bold">
          {t`どこへ向かいますか？`}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {left.map((s) => {
            const info = session.stops[s.id];
            const closed = s.status === "closed";
            const now = snap.state.targetId === s.id;
            return (
              <li key={s.id}>
                <button type="button" disabled={closed || now} onClick={() => pick(s.id)} className={row}>
                  <span className="min-w-0">
                    <span lang={info?.nameLang} className="block">
                      {info?.name ?? ""}
                    </span>
                    <span className="block text-base font-normal text-muted">{closed ? t`閉鎖中` : now ? t`いま向かっている場所` : away(s)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          {snap.forcedId ? (
            <button type="button" onClick={() => pick(null)} className={buttonStyle("primary", "lg", "flex w-full")}>
              {t`近い順にもどす`}
            </button>
          ) : null}
          <button type="button" onClick={() => dialog.current?.close()} className={buttonStyle("secondary", "lg", "flex w-full")}>
            {t`とじる`}
          </button>
        </div>
      </dialog>
    </>
  );
}
