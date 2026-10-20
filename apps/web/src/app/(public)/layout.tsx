import type { ReactNode } from "react";
import { MenuProvider } from "@/components/MenuProvider";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { NavigationToast } from "@/components/navigation/NavigationHud";
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

// Participant side: mobile first. A slim bar on top (menu), the page, and a tab bar at the bottom.
//   Tablet (768 px and up): a side rail on the left and one centred column.
//   Desktop (1024 px and up): a sidebar fixed to the far left of the screen (logo, tabs, and the site's footer links
//   at its bottom, always in view) and a wide content area; each page lays itself out in several columns there.
// The bottom padding keeps content clear of the phone's tab bar.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();
  const sample = sampleContentEnabled();
  const viewer = await getViewer();
  const prefsState = await getPrefsState();

  return (
    <MenuProvider>
      <NavigationProvider signedIn={viewer.signedIn}>
      <StampFilters />
      <div className="mx-auto flex w-full max-w-5xl justify-center md:gap-6 lg:mx-0 lg:max-w-none lg:justify-start lg:gap-0">
        {/* The footer lives in the sidebar on a desktop (and is hidden on the map, whose page has no room for it). */}
        <TabBar footer={<SiteFooter locale={i18n.locale} variant="sidebar" />} />
        <div className="min-w-0 max-w-xl flex-1 md:border-x md:border-surface lg:max-w-none lg:border-x-0">
          <SiteHeader signedIn={viewer.signedIn} name={viewer.name} sample={sample} devTools={process.env.NODE_ENV !== "production"} />
          <OfflineNotice />
          {sample ? <SampleNoticeHost /> : null}
          <PrefsSync signedIn={viewer.signedIn} account={prefsState.account} device={prefsState.device} />
          <main id="main" className="pb-[calc(7rem+var(--nav-toast,0px))] md:pb-[calc(2.5rem+var(--nav-toast,0px))] md:pt-6 lg:pb-[calc(5rem+var(--nav-toast,0px))] lg:pt-8">
            <div className="lg:mx-auto lg:max-w-6xl lg:px-10">{children}</div>
            <div className="lg:hidden">
              <SiteFooter locale={i18n.locale} />
            </div>
          </main>
        </div>
      </div>
      <NavigationToast />
      </NavigationProvider>
    </MenuProvider>
  );
}
