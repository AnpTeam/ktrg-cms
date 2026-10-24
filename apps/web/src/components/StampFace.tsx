import type { CSSProperties, ReactNode } from "react";

export type StampState = "stamped" | "next" | "empty";

// Three shapes, so the state never depends on colour alone:
//  stamped: a solid vermilion seal with a paper-coloured frame line
//  next:    a thick indigo ring (the word 「つぎ」 is added inside the slot)
//  empty:   a dashed outline
const faces: Record<StampState, string> = {
  stamped:
    "bg-shu text-on-shu shadow-[inset_0_0_0_3px_var(--color-shu),inset_0_0_0_5px_var(--color-on-shu)]",
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
  rough = false,
  image,
  children,
}: {
  state: StampState;
  number?: number;
  className?: string;
  /** Make a stamped seal look pressed by hand (a wobbly edge, gaps in the ink). For big seals only: at a few pixels it is just noise. */
  rough?: boolean;
  /** The place's own stamp picture; it takes the seal's place, dimmed and grey until the stamp is held. */
  image?: string | null;
  children?: ReactNode;
}) {
  if (image && state !== "next") {
    // eslint-disable-next-line @next/next/no-img-element -- an admin-chosen picture from the photo host, shown as it is
    return <img src={image} alt="" aria-hidden="true" className={`rounded-lg object-contain ${state === "stamped" ? "" : "opacity-40 grayscale"} ${className}`} />;
  }
  const style: CSSProperties | undefined =
    state === "stamped"
      ? {
          ...(number !== undefined ? { transform: `rotate(${tilt(number)}deg)` } : null),
          ...(rough ? { filter: `url(#stamp-ink-${((number ?? 0) % 3) + 1})` } : null),
        }
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
