import type { Metadata } from "next";
import { FaqView } from "@/components/pages/PageViews";
import { initLingui } from "@/i18n/server";
import { helpFor } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: (await helpFor(i18n.locale)).faqTitle };
}

export default async function FaqPage() {
  const i18n = await initLingui();
  return <FaqView help={await helpFor(i18n.locale)} />;
}
