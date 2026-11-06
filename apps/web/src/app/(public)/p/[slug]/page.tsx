import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomPageView } from "@/components/pages/PageViews";
import { initLingui } from "@/i18n/server";
import { customPage, customPageIn } from "@/lib/page-text-server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i18n = await initLingui();
  const page = await customPage((await params).slug);
  return page ? { title: customPageIn(page, i18n.locale).title } : {};
}

// A page an editor made in the admin (管理 > ページの文章 > 新しいページ). Only published ones are found.
export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const i18n = await initLingui();
  const page = await customPage((await params).slug);
  if (!page) notFound();
  return <CustomPageView {...customPageIn(page, i18n.locale)} />;
}
