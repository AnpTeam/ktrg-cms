import Link from "next/link";
import type { ReactNode } from "react";

/** The one primary action on a screen: full width, 3.5rem tall, plain words. */
export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="tap-target flex min-h-14 items-center justify-center rounded-xl bg-ink px-6 text-xl font-bold text-paper"
    >
      {children}
    </Link>
  );
}
