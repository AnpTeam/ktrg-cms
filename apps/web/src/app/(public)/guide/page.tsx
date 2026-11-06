import type { Metadata } from "next";
import { GuideView } from "@/components/pages/PageViews";
import { initLingui } from "@/i18n/server";
import { helpFor } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: (await helpFor(i18n.locale)).guideTitle };
}

export default async function GuidePage() {
  const i18n = await initLingui();
  return <GuideView help={await helpFor(i18n.locale)} />;
}
