"use client";

import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Medal } from "./Medal";
import { STAMP_POPUP_CLOSED_EVENT, STAMP_PROGRESS_EVENT, type StampProgress } from "@/lib/stamp-progress";

/**
 * "Stamp collected": a popup after a new stamp in a rally. The ring starts where it was and fills to the new count; when the
 * rally is complete the medal turns vermilion with a pop. No timer closes it (people read at their own speed); calm turns the
 * movement off (the ring then simply shows the new count).
 */
export function StampProgressPopup() {
  const { t } = useLingui();
  const dialog = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<StampProgress | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let timer: number | undefined;
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<StampProgress>).detail;
      window.clearTimeout(timer);
      // Let the press animation on the page land first.
      timer = window.setTimeout(() => {
        setInfo(detail);
        setShown(detail.before);
        dialog.current?.showModal();
        // Next frames: the ring moves from `before` to `after` (a CSS transition).
        window.setTimeout(() => setShown(detail.after), 400);
      }, 700);
    };
    window.addEventListener(STAMP_PROGRESS_EVENT, onEvent);
    return () => {
      window.removeEventListener(STAMP_PROGRESS_EVENT, onEvent);
      window.clearTimeout(timer);
    };
  }, []);

  const done = info !== null && shown >= info.total && info.total > 0;
  return (
    <dialog ref={dialog} aria-labelledby="stamp-progress-title" onClose={() => {
        setInfo(null);
        window.dispatchEvent(new Event(STAMP_POPUP_CLOSED_EVENT));
      }} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-paper p-6 text-center text-ink backdrop:bg-black/60">
      {info ? (
        <div className="flex flex-col items-center gap-3">
          <h2 id="stamp-progress-title" className="text-2xl font-bold">
            {done ? t`コンプリート！` : t`スタンプを押しました！`}
          </h2>
          <p className="text-lg font-bold">{info.place}</p>
          <div className={done ? "medal-pop" : ""}>
            <Medal number={Math.min(shown, info.total)} done={done} stamped={shown} total={info.total} className="h-40 w-auto" />
          </div>
          <p className="text-lg">{info.rallyName}</p>
          <p className="text-3xl font-bold tabular-nums text-accent" role="status">
            {Math.min(shown, info.total)} / {info.total}
          </p>
          <button type="button" onClick={() => dialog.current?.close()} className="tap-target mt-2 flex min-h-14 w-full items-center justify-center rounded-xl bg-ink px-6 text-xl font-bold text-paper">
            {t`とじる`}
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
