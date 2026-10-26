import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";

/** The way back to a list at the top of an admin page: a button, so it is easy to see. */
export function AdminBack({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="tap-target inline-flex w-fit items-center gap-1 rounded-xl border-2 border-ink bg-surface px-4 text-lg font-bold text-ink hover:bg-paper">
      <ChevronLeftIcon />
      {children}
    </Link>
  );
}
