"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";

// The two moments a navigation stops to ask something, as cards in the middle of the screen: at a stamp place, and just past one.

const CARD = "w-full max-w-sm rounded-2xl bg-paper p-5 text-ink shadow-2xl";
const COVER = "fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4";
/** Long enough to read and answer with a walking pole in one hand. */
const PASSED_WAIT_S = 20;

/** At a stamp place: the stamp button, up front. "Later" leaves the small button at the bottom of the screen. */
export function ArrivalPrompt({ name, nameLang, onLater, children }: { name: string; nameLang: "ja" | "en"; onLater: () => void; children: ReactNode }) {
  const { t } = useLingui();
  return (
    <div className={COVER}>
      <section role="dialog" aria-modal="true" aria-labelledby="nav-arrived" className={`${CARD} flex flex-col gap-3`}>
        <p className="text-lg font-bold text-accent">{t`着きました`}</p>
        <h2 id="nav-arrived" lang={nameLang} className="font-serif text-2xl font-bold leading-snug">
          {name}
        </h2>
        {children}
        <button type="button" onClick={onLater} className={buttonStyle("secondary", "md", "flex w-full")}>
          {t`あとで`}
        </button>
      </section>
    </div>
  );
}

/** Before ending a navigation. Going on comes first, so a second tap in the same place cannot end the walk by mistake. */
export function EndPrompt({ onEnd, onKeep }: { onEnd: () => void; onKeep: () => void }) {
  const { t } = useLingui();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="nav-end" onClose={onKeep} className={`${CARD} m-auto backdrop:bg-black/50`}>
      <h2 id="nav-end" className="text-2xl font-bold leading-snug">
        {t`ナビを終えますか？`}
      </h2>
      <p className="mt-2 text-lg leading-snug">{t`押したスタンプは消えません。`}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" autoFocus onClick={onKeep} className={buttonStyle("primary", "md", "flex w-full")}>
          {t`ナビをつづける`}
        </button>
        <button type="button" onClick={onEnd} className={buttonStyle("secondary", "md", "flex w-full")}>
          {t`ナビを終える`}
        </button>
      </div>
    </dialog>
  );
}

/** Just past a stamp place without stamping. Nobody has to answer: after a moment the walk simply goes on to the next one. */
export function PassedPrompt({ name, nameLang, onGoOn, onGoBack }: { name: string; nameLang: "ja" | "en"; onGoOn: () => void; onGoBack: () => void }) {
  const { t } = useLingui();
  const [left, setLeft] = useState(PASSED_WAIT_S);
  const goOn = useRef(onGoOn);
  useEffect(() => {
    goOn.current = onGoOn;
  }, [onGoOn]);
  // Counted from the clock, not from ticks: a phone in a pocket slows timers down.
  useEffect(() => {
    const ends = Date.now() + PASSED_WAIT_S * 1000;
    const id = setInterval(() => {
      const s = Math.ceil((ends - Date.now()) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) {
        clearInterval(id);
        goOn.current();
      }
    }, 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={COVER}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="nav-passed" className={`${CARD} flex flex-col gap-3`}>
        <h2 id="nav-passed" className="text-xl font-bold leading-snug">
          <span lang={nameLang}>{name}</span>
          {t`を通りすぎました`}
        </h2>
        <p className="text-lg leading-snug">{t`次の場所へ進みますか？`}</p>
        <button type="button" onClick={onGoOn} className={buttonStyle("action", "lg", "flex w-full tabular-nums")}>
          {t`次へ進む（${left}秒）`}
        </button>
        <button type="button" onClick={onGoBack} className={buttonStyle("secondary", "md", "flex w-full")}>
          {t`もどる`}
        </button>
      </section>
    </div>
  );
}
