import type { Metadata } from "next";
import { TermsView } from "@/components/pages/PageViews";
import { initLingui } from "@/i18n/server";
import { termsFor } from "@/lib/page-text-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  const t = await termsFor(i18n.locale);
  return { title: t.builtIn && i18n.locale !== "ja" ? "Terms of use" : t.title };
}

export default async function TermsPage() {
  const i18n = await initLingui();
  return <TermsView terms={await termsFor(i18n.locale)} locale={i18n.locale} />;
}
