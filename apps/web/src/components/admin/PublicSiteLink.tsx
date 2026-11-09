"use client";

import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { ExternalIcon } from "@/components/icons";
import { publicPathFor } from "@/lib/admin/public-path";

/** At the top of the admin menu, beside the fold button; folded, only its icon shows. */
export function PublicSiteLink() {
  const { t } = useLingui();
  const href = publicPathFor(usePathname() ?? "/admin");
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={t`公開サイトで見る`}
      className="tap-target inline-flex items-center justify-center gap-2 rounded-full border-2 border-line px-4 text-base font-bold text-ink hover:bg-surface lg:group-data-[folded=true]:px-0 [&>svg]:shrink-0"
    >
      <ExternalIcon />
      <span className="whitespace-nowrap lg:group-data-[folded=true]:sr-only">{t`サイトで見る`}</span>
    </a>
  );
}
