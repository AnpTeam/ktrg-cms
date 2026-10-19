"use client";

import { useId, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";

/** A text longer than this (in characters) starts folded to a few lines, with a button to read the rest. */
export const FOLD_AFTER_CHARS = 200;

/**
 * A long text folded to a few lines, with a big button to open it and close it again. A short text is shown whole and
 * has no button. Line breaks of the text are kept by the caller (`whitespace-pre-line`). The folded part is still in
 * the page for search and for screen readers; the button says whether it is open.
 */
export function ExpandableText({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = text.length > FOLD_AFTER_CHARS;
  return (
    <div>
      <p id={id} className={`${className} ${long && !open ? "line-clamp-5" : ""}`}>
        {children}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="tap-target mt-1 inline-flex items-center text-lg font-bold text-accent underline underline-offset-4"
        >
          {open ? t`閉じる` : t`続きを読む`}
        </button>
      ) : null}
    </div>
  );
}
