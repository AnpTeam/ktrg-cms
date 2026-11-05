import Link from "next/link";
import type { ReactNode } from "react";
import { buttonStyle } from "@/components/button";

/** The one primary action on a screen: full width, 3.5rem tall, plain words. */
export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={buttonStyle("primary", "lg", "flex")}
    >
      {children}
    </Link>
  );
}
