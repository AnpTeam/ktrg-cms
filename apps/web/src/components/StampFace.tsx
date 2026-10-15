import type { ReactNode } from "react";

export type StampState = "stamped" | "next" | "empty";

// Three shapes, so the state never depends on colour alone:
//  stamped: a solid vermilion seal with a paper-coloured frame line
//  next:    a thick indigo ring (the word 「つぎ」 is added inside the slot)
//  empty:   a dashed outline
const faces: Record<StampState, string> = {
  stamped:
    "bg-shu text-paper shadow-[inset_0_0_0_3px_var(--color-shu),inset_0_0_0_5px_var(--color-paper)]",
  next: "border-4 border-accent bg-surface text-accent",
  empty: "border-2 border-dashed border-line bg-paper text-muted",
};

// A real ink stamp is never quite straight: a deterministic tilt of -2..2 degrees.
export function tilt(n: number) {
  return ((n * 7) % 5) - 2;
}

export function StampFace({
  state,
  number,
  className = "",
  children,
}: {
  state: StampState;
  number?: number;
  className?: string;
  children?: ReactNode;
}) {
  const style =
    state === "stamped" && number !== undefined
      ? { transform: `rotate(${tilt(number)}deg)` }
      : undefined;
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`flex flex-col items-center justify-center rounded-lg ${faces[state]} ${className}`}
    >
      {children}
    </div>
  );
}
