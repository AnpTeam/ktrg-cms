import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BookmarkList } from "@/components/BookmarkList";
import { listRallies, listRoutes } from "@/lib/content";
import { initLingui } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ブックマーク`) };
}

// Saved routes live on the device (lib/bookmarks.ts), so the page itself is the same for everyone and the list fills in in the browser.
export default async function BookmarksPage() {
  const i18n = await initLingui();
  return (
    <div className="flex flex-col gap-6 pt-2 lg:pt-0">
      <h1 className="px-4 text-3xl font-bold lg:text-4xl">
        <Trans>ブックマーク</Trans>
      </h1>
      <BookmarkList locale={i18n.locale} routes={await listRoutes()} rallies={await listRallies()} />
    </div>
  );
}
