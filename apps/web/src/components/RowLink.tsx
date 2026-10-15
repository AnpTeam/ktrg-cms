import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronIcon } from "./icons";

/** A full-width list row: a heavy rule above and below, a chevron at the right. */
export function RowLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="tap-target flex items-center justify-between gap-4 border-y-2 border-line px-4 py-5 hover:bg-surface"
    >
      <span>
        <span className="block text-xl font-bold">{title}</span>
        {detail ? <span className="block text-lg text-muted">{detail}</span> : null}
      </span>
      <span className="shrink-0">
        <ChevronIcon />
      </span>
    </Link>
  );
}
