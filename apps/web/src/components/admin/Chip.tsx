import type { Tone } from "@/lib/admin/lists/config";

// A short state in a list ("Published", "Administrator"). The text is always the plain ink colour; the tone shows in the
// border and in a mark before the word, so it never depends on colour alone.
const TONES: Record<Tone, { box: string; mark: string }> = {
  neutral: { box: "border-line bg-surface", mark: "" },
  good: { box: "border-moss bg-paper", mark: "✓ " },
  warn: { box: "border-caution bg-paper", mark: "! " },
  bad: { box: "border-danger bg-paper", mark: "× " },
  info: { box: "border-accent bg-paper", mark: "" },
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  const { box, mark } = TONES[tone];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-base font-bold text-ink ${box}`}>
      {mark ? <span aria-hidden="true">{mark}</span> : null}
      {children}
    </span>
  );
}
