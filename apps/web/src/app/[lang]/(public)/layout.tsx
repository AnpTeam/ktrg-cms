import type { ReactNode } from "react";
import { MenuProvider } from "@/components/MenuProvider";
import { OfflineNotice } from "@/components/OfflineNotice";
import { SampleNoticeHost } from "@/components/SampleNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { StampFilters } from "@/components/StampFilters";
import { SiteHeader } from "@/components/SiteHeader";
import { TabBar } from "@/components/TabBar";
import { PrefsSync } from "@/components/settings/PrefsSync";
import { getPrefsState } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";
import { sampleContentEnabled } from "@/lib/content";
import { initLingui } from "@/i18n/server";

// Participant side: mobile first. A slim bar on top (menu), the page, and a tab bar at the bottom (a side rail on
// wide screens). The bottom padding keeps content clear of the tab bar.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();
  const sample = sampleContentEnabled();
  const viewer = await getViewer();
  const prefsState = await getPrefsState();

  // Phone: the page fills the width and the tab bar is at the bottom. Wider screens work like Twitter: the
  // page is one centred column, the navigation moves to a rail on its left, and an empty space of the same
  // width on the right keeps the column in the middle.
  return (
    <MenuProvider>
    <StampFilters />
    <div className="mx-auto flex w-full max-w-5xl justify-center md:gap-6 lg:gap-10">
      <TabBar />
      <div className="min-w-0 max-w-xl flex-1 md:border-x md:border-surface">
        <SiteHeader signedIn={viewer.signedIn} name={viewer.name} sample={sample} devTools={process.env.NODE_ENV !== "production"} />
        <OfflineNotice />
        {sample ? <SampleNoticeHost /> : null}
        <PrefsSync signedIn={viewer.signedIn} account={prefsState.account} device={prefsState.device} />
        <main id="main" className="pb-28 md:pb-10 md:pt-6">
          {children}
          <SiteFooter locale={i18n.locale} />
        </main>
      </div>
      <div aria-hidden="true" className="hidden w-60 shrink-0 lg:block" />
    </div>
    </MenuProvider>
  );
}
