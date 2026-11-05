import { notFound } from "next/navigation";

// An address that matches no page lands here, so it gets our own not-found page (bilingual, with the header and tabs)
// instead of Next's bare English one. Real pages, files and the /api/v1 rewrite are all matched before a catch-all.
export default function Missing() {
  notFound();
}
