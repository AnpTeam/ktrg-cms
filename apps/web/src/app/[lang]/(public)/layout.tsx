import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SampleBanner } from "@/components/SampleBanner";
import { TabBar } from "@/components/TabBar";
import { initLingui } from "@/i18n/server";

// Participant side: mobile first. A slim language bar on top, the page, and a
// tab bar at the bottom. The bottom padding keeps content clear of the tab bar.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  await initLingui();

  return (
    <>
      <header className="mx-auto flex max-w-xl justify-end px-4 py-3">
        <LocaleSwitcher />
      </header>
      <main id="main" className="mx-auto max-w-xl pb-32">
        <SampleBanner />
        {children}
      </main>
      <TabBar />
    </>
  );
}
