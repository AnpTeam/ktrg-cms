"use client";

import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { ExternalIcon } from "@/components/icons";

/**
 * The page visitors see for an admin page: the same route, place, page or post, or the list they appear in. Null when the
 * admin page has no page of its own on the site (the dashboard, users, the waypoint list...): then no button is shown.
 */
export function publicPathFor(adminPath: string): string | null {
  const [, , area, id] = adminPath.split("/");
  const one = id && id !== "new" ? id : null;
  switch (area) {
    case "routes":
      return id === "new" ? null : one ? `/routes/${one}` : "/routes";
    case "places":
      return one ? `/spots/${one}` : null;
    case "pages":
      return one === "home" ? "/" : one;
    case "rallies":
      return id === "new" ? null : one ? `/rallies/${one}` : "/rallies";
    case "posts":
      return id === "new" ? null : one ? `/blog/${one}` : "/blog";
    case "notices":
      return "/notices";
    case "banners":
      return "/";
    default:
      return null;
  }
}

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
