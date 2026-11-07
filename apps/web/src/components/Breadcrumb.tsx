"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronIcon } from "./icons";

/** A breadcrumb step. Not used yet: tried on the admin, where the back button read better; kept for the places directory (tourist information, gourmet, souvenirs). */
export function Breadcrumb({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useLingui();
  return (
    <nav aria-label={t`現在の場所`} className="flex w-fit items-center gap-1 text-lg font-bold">
      <Link href={href} className="tap-target inline-flex items-center text-accent underline underline-offset-4">
        {children}
      </Link>
      <span aria-hidden="true" className="text-muted">
        <ChevronIcon size={20} />
      </span>
    </nav>
  );
}
