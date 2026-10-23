"use client";

import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";

/**
 * The box holding a photo's link, folded away: photos are normally uploaded or picked from the library, so the link
 * (which that fills in) stays out of sight. It opens by itself when the link has a problem, and anyone who wants to
 * paste an address by hand can still open it.
 */
export function PhotoLinkDetails({ children, open = false }: { children: ReactNode; open?: boolean }) {
  const { t } = useLingui();
  return (
    <details open={open || undefined} className="rounded-xl border-2 border-line px-4 py-2">
      <summary className="tap-target flex cursor-pointer items-center text-lg font-bold">{t`リンクを直接入れる`}</summary>
      <div className="pb-2 pt-1">{children}</div>
    </details>
  );
}
