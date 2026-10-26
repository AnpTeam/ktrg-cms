import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "./icons";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="back-link tap-target inline-flex items-center gap-1 text-lg font-bold text-accent underline underline-offset-4"
    >
      <ChevronLeftIcon />
      {children}
    </Link>
  );
}
