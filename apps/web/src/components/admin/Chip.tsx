import type { ReactNode } from "react";
import type { Tone } from "@/lib/admin/lists/config";
import { AlertIcon, TickIcon, XIcon } from "@/components/icons";

// A short state in a list ("Published", "Administrator"). The text is always the plain ink colour; the tone shows in the
// border and in a mark before the word, so it never depends on colour alone.
const TONES: Record<Tone, { box: string; mark: ReactNode }> = {
  neutral: { box: "border-line bg-surface", mark: null },
  good: { box: "border-moss bg-paper", mark: <TickIcon size={16} /> },
  warn: { box: "border-caution bg-paper", mark: <AlertIcon size={16} /> },
  bad: { box: "border-danger bg-paper", mark: <XIcon size={16} /> },
  info: { box: "border-accent bg-paper", mark: null },
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  const { box, mark } = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-base font-bold text-ink ${box}`}>
      {mark}
      {children}
    </span>
  );
}
