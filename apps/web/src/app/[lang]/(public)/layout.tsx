import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SampleNoticeButton, SampleNoticeHost } from "@/components/SampleNotice";
import { TabBar } from "@/components/TabBar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { sampleContentEnabled } from "@/lib/content";
import { initLingui } from "@/i18n/server";

// Participant side: mobile first. A slim bar on top (theme and language), the page, and a
// tab bar at the bottom. The bottom padding keeps content clear of the tab bar.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  await initLingui();
  const sample = sampleContentEnabled();

  return (
    <>
      <header className="mx-auto flex max-w-xl items-center justify-between gap-1.5 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ThemeSwitcher />
          {sample ? <SampleNoticeButton /> : null}
        </div>
        <LocaleSwitcher />
      </header>
      {sample ? <SampleNoticeHost /> : null}
      <main id="main" className="mx-auto max-w-xl pb-32">
        {children}
      </main>
      <TabBar />
    </>
  );
}
