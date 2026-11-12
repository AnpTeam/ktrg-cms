import type { ReactNode } from "react";

/** An empty screen says what is going on and, when there is one, what to do next. */
export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <section className="mx-4 rounded-[1.75rem] bg-surface p-5">
      <h2 className="font-serif text-xl font-bold text-accent">{title}</h2>
      {children ? <div className="mt-3 text-lg">{children}</div> : null}
    </section>
  );
}
