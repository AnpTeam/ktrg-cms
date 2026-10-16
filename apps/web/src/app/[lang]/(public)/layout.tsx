import type { ReactNode } from "react";
import { SampleNoticeHost } from "@/components/SampleNotice";
import { SiteHeader } from "@/components/SiteHeader";
import { TabBar } from "@/components/TabBar";
import { getViewer } from "@/lib/viewer";
import { sampleContentEnabled } from "@/lib/content";
import { initLingui } from "@/i18n/server";

// Participant side: mobile first. A slim bar on top (theme and language), the page, and a
// tab bar at the bottom. The bottom padding keeps content clear of the tab bar.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  await initLingui();
  const sample = sampleContentEnabled();
  const viewer = await getViewer();

  return (
    <>
      <SiteHeader signedIn={viewer.signedIn} name={viewer.name} sample={sample} devTools={process.env.NODE_ENV !== "production"} />
      {sample ? <SampleNoticeHost /> : null}
      <main id="main" className="mx-auto max-w-xl pb-24">
        {children}
      </main>
      <TabBar />
    </>
  );
}
