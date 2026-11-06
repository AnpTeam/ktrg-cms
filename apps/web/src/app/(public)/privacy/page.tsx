import type { Metadata } from "next";
import { PolicyView } from "@/components/pages/PageViews";
import { initLingui } from "@/i18n/server";
import { policyFor } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: (await policyFor(i18n.locale)).title };
}

// The policy text lives in lib/privacy-content.ts (one copy per language), not in the message catalogs: it is a
// document, and the two versions are written and checked as wholes.
export default async function PrivacyPage() {
  const i18n = await initLingui();
  return <PolicyView policy={await policyFor(i18n.locale)} />;
}
