import { VisitBeacon } from "@/components/VisitBeacon";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { MenuProvider } from "@/components/MenuProvider";
import { StampOutbox } from "@/components/StampOutbox";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { speaksByDefault } from "@/lib/navigation/voice";
import { NavigationToast } from "@/components/navigation/NavigationHud";
import { OfflineNotice } from "@/components/OfflineNotice";
import { SampleNoticeHost } from "@/components/SampleNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { StampFilters } from "@/components/StampFilters";
import { BookmarkProvider } from "@/components/useBookmarks";
import { IntroFlow } from "@/components/IntroFlow";
import { BrowserWarning } from "@/components/BrowserWarning";
import { GuestClaim } from "@/components/GuestClaim";
import { GuestNag } from "@/components/GuestNag";
import { StampProgressPopup } from "@/components/StampProgressPopup";
import { FuriganaLayer } from "@/components/FuriganaLayer";
import { SiteHeader } from "@/components/SiteHeader";
import { TabBar } from "@/components/TabBar";
import { PrefsSync } from "@/components/settings/PrefsSync";
import { SessionRotate } from "@/components/settings/SessionRotate";
import { getPrefsState } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";
import { sampleContentEnabled } from "@/lib/content";
import { helpFor } from "@/lib/page-text-server";
import { plainBody } from "@/lib/rich-text";
import { initLingui } from "@/i18n/server";

// Participant side: mobile first. A slim bar on top (menu), the page, and a tab bar at the bottom.
//   Tablet (768 px and up): a side rail on the left and one centred column.
//   Desktop (1024 px and up): a sidebar fixed to the far left of the screen (logo, tabs, and the site's footer links
//   at its bottom, always in view) and a wide content area; each page lays itself out in several columns there.
// The bottom padding keeps content clear of the phone's tab bar.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const i18n = await initLingui();
  const sample = sampleContentEnabled();
  const [viewer, prefsState, jar] = await Promise.all([getViewer(), getPrefsState(), cookies()]);
  // Stamps held without an account live in a signed cookie (guest/ in the API); the server only needs to know it is there.
  const hasGuestStamps = jar.has("guest") || jar.has("__Host-guest");
  // The intro's how-to-play step shows the same text as the 遊び方 page (the editor's, else the built-in), as plain words.
  const introSeen = jar.has("intro");
  const guide = viewer.signedIn || introSeen ? null : await helpFor(i18n.locale).then((h) => ({ title: h.guideTitle, intro: plainBody(h.guideIntro), steps: h.steps.map((s) => ({ title: s.title, text: plainBody(s.text) })) }));

  return (
    <MenuProvider>
      <BookmarkProvider signedIn={viewer.signedIn} ids={viewer.bookmarks}>
      <NavigationProvider signedIn={viewer.signedIn} voiceByDefault={speaksByDefault(viewer.ageRange)}>
      <VisitBeacon />
      <StampFilters />
      <div className="mx-auto flex w-full max-w-5xl justify-center md:gap-6 wide:mx-0 wide:max-w-none wide:justify-start wide:gap-0">
        {/* The footer lives in the sidebar on a desktop (and is hidden on the map, whose page has no room for it). */}
        <TabBar footer={<SiteFooter locale={i18n.locale} variant="sidebar" />} />
        <div className="min-w-0 max-w-xl flex-1 md:border-x md:border-surface wide:max-w-none wide:border-x-0">
          <SiteHeader
            signedIn={viewer.signedIn}
            staff={viewer.role === "editor" || viewer.role === "admin"}
            locale={i18n.locale}
            profile={{ publicId: viewer.publicId, deletionDueAt: viewer.deletionDueAt, name: viewer.name, origin: viewer.origin, originPlace: viewer.originPlace, ageRange: viewer.ageRange, gender: viewer.gender, foundVia: viewer.foundVia }}
            prefs={prefsState.effective}
            sample={sample}
          />
          <OfflineNotice />
          {sample ? <SampleNoticeHost /> : null}
          <PrefsSync signedIn={viewer.signedIn} account={prefsState.account} device={prefsState.device} />
          {viewer.signedIn ? <SessionRotate /> : null}
          <main id="main" className="pb-[calc(7rem+var(--nav-toast,0px))] md:pb-[calc(2.5rem+var(--nav-toast,0px))] md:pt-6 md:has-[[data-landing-top]]:pt-0 wide:pb-[calc(5rem+var(--nav-toast,0px))] wide:pt-8 wide:has-[[data-landing-top]]:pt-0">
            <div className="wide:mx-auto wide:max-w-6xl wide:px-10">
              {viewer.signedIn ? null : <BrowserWarning />}
              {children}
            </div>
          </main>
        </div>
      </div>
      {viewer.signedIn ? null : <IntroFlow seen={introSeen} guide={guide} />}
      {viewer.signedIn ? (hasGuestStamps ? <GuestClaim /> : null) : <GuestNag hasStamps={hasGuestStamps} />}
      {prefsState.effective.furigana ? <FuriganaLayer /> : null}
      <StampProgressPopup />
      <StampOutbox userKey={viewer.signedIn ? (viewer.publicId ?? "guest") : "guest"} />
      <NavigationToast />
      </NavigationProvider>
      </BookmarkProvider>
    </MenuProvider>
  );
}
