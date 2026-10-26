"use client";

import { usePathname } from "next/navigation";
import { useLingui } from "@lingui/react/macro";

/** The page visitors see for an admin page: the same route, place or list when there is one, else the top page. */
export function publicPathFor(adminPath: string): string {
  const [, , area, id] = adminPath.split("/");
  switch (area) {
    case "routes":
      return id && id !== "new" ? `/routes/${id}` : "/routes";
    case "places":
      return id && id !== "new" ? `/spots/${id}` : "/map";
    case "pages":
      return id ? `/${id}` : "/";
    case "rallies":
      return "/rallies";
    case "notices":
      return "/notices";
    case "directory":
      return "/map";
    default:
      return "/";
  }
}

export function PublicSiteLink() {
  const { t } = useLingui();
  const href = publicPathFor(usePathname() ?? "/admin");
  return (
    <a href={href} target="_blank" rel="noreferrer" className="tap-target inline-flex items-center text-base font-bold text-accent underline underline-offset-4">
      {t`公開サイトで見る`}
    </a>
  );
}
