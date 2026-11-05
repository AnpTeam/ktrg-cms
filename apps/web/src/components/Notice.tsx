import type { ReactNode } from "react";
import { InfoIcon } from "./icons";

/** A standing note, such as "check official sources". Icon plus words, never colour alone. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-4 flex items-start gap-3 rounded-2xl bg-surface p-4 text-lg">
      <span className="mt-0.5 shrink-0">
        <InfoIcon />
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
