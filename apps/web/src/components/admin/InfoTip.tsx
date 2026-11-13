"use client";

import { useId, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { InfoIcon } from "@/components/icons";

/**
 * A label with its explanation tucked behind an (i) button. Tapping the button opens the explanation right under the label
 * (no hover, so it works on touch and with a keyboard); tapping again closes it. With no explanation it is just the label.
 * Warnings and errors do not belong here: they stay visible next to the field.
 */
export function InfoTip({ label, hint, indent = false }: { label: ReactNode; hint?: ReactNode; /** The explanation lines up under the words of a checkbox, not under its box. */ indent?: boolean }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!hint) return <>{label}</>;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-1">
        {label}
        {/* The box is 48 px for a finger; the negative margin keeps it from making the row taller. */}
        <button type="button" aria-expanded={open} aria-controls={id} aria-label={t`説明`} onClick={() => setOpen(!open)} className="tap-target -my-3 inline-flex items-center justify-center rounded-full text-muted hover:text-ink aria-expanded:text-ink">
          <InfoIcon />
        </button>
      </div>
      {open ? (
        <p id={id} className={`text-base text-muted ${indent ? "pl-9" : ""}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
