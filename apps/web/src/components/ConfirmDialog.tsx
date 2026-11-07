"use client";

import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { buttonStyle } from "@/components/button";
import { WarningIcon } from "@/components/icons";

const CONFIRM_EVENT = "ktrg:confirm";

export interface ConfirmAsk {
  /** The short question. */
  title: string;
  /** What will happen, if the question alone does not say. */
  body?: string;
  /** Names the action ("削除する"), never just "OK". */
  yes: string;
  no?: string;
}

type Asked = ConfirmAsk & { answer: (yes: boolean) => void };

/** Our own window.confirm: resolves true only if the person chose `yes`. ConfirmHost in the root layout shows it. */
export function confirmDialog(ask: ConfirmAsk): Promise<boolean> {
  return new Promise((answer) => {
    window.dispatchEvent(new CustomEvent<Asked>(CONFIRM_EVENT, { detail: { ...ask, answer } }));
  });
}

/** The safe answer comes first and has the focus; Esc is the same as that answer. */
export function ConfirmHost() {
  const { t } = useLingui();
  const dialog = useRef<HTMLDialogElement>(null);
  const waiting = useRef<Asked | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);

  useEffect(() => {
    const onAsk = (e: Event) => {
      const next = (e as CustomEvent<Asked>).detail;
      waiting.current?.answer(false); // a question left open never hangs its caller
      waiting.current = next;
      setAsked(next);
    };
    window.addEventListener(CONFIRM_EVENT, onAsk);
    return () => window.removeEventListener(CONFIRM_EVENT, onAsk);
  }, []);

  // After the render, so the buttons exist and autoFocus lands on one.
  useEffect(() => {
    if (asked && !dialog.current?.open) dialog.current?.showModal();
  }, [asked]);

  const settle = (yes: boolean) => {
    waiting.current?.answer(yes);
    waiting.current = null;
    setAsked(null);
    dialog.current?.close();
  };

  return (
    <dialog ref={dialog} aria-labelledby="confirm-title" onClose={() => settle(false)} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-paper p-5 text-ink shadow-2xl backdrop:bg-black/50">
      {asked ? (
        <>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-caution">
              <WarningIcon />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-2xl font-bold leading-snug">
                {asked.title}
              </h2>
              {asked.body ? <p className="mt-2 text-lg leading-snug">{asked.body}</p> : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" autoFocus onClick={() => settle(false)} className={buttonStyle("secondary", "md", "flex flex-1 whitespace-nowrap")}>
              {asked.no ?? t`もどる`}
            </button>
            <button type="button" onClick={() => settle(true)} className={buttonStyle("action", "md", "flex flex-1 whitespace-nowrap")}>
              {asked.yes}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
