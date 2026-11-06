"use client";

import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { primaryButton } from "@/components/auth/authUi";

/** The (?) button under the zoom buttons: how to move the map with your fingers. Phones only, since these are touch gestures. */
export function MapHelp() {
  const { t } = useLingui();
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = [
    [t`動かす`, t`1本の指でなぞります。`],
    [t`大きくする・小さくする`, t`2本の指を広げたり、せばめたりします。`],
    [t`傾ける`, t`3本の指で、上下になぞります。`],
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={t`地図の使い方`}
        className="tap-target inline-flex items-center justify-center rounded-lg border border-ink bg-paper px-3 text-2xl font-bold text-ink hover:bg-surface md:hidden"
      >
        ?
      </button>
      <dialog ref={dialog} aria-labelledby="map-help-title" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-ink backdrop:bg-black/60">
        <h2 id="map-help-title" className="text-2xl font-bold">
          {t`地図の使い方`}
        </h2>
        <dl className="mt-4 flex flex-col gap-3">
          {rows.map(([name, how]) => (
            <div key={name}>
              <dt className="text-lg font-bold">{name}</dt>
              <dd className="text-lg">{how}</dd>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => dialog.current?.close()} className={`${primaryButton} mt-5 w-full`}>
          {t`閉じる`}
        </button>
      </dialog>
    </>
  );
}
