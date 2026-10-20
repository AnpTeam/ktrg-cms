import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { initLingui } from "@/i18n/server";
import { getMapSettings } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`サイト全体の設定（管理）`) };
}

/** Settings that change the live site for everyone. The API checks the admin role again on every save. */
export default async function SiteSettingsPage() {
  const settings = await getMapSettings();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold">
        <Trans>サイト全体の設定</Trans>
      </h1>
      <p className="text-lg text-muted">
        <Trans>サイトの全体に関わる設定です。ここで変えたことは、すぐに訪問者の画面に反映されます。</Trans>
      </p>
      <SiteSettingsForm initial={settings} />
    </div>
  );
}
