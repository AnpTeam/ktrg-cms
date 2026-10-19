import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { PrefsForm } from "@/components/settings/PrefsForm";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`見やすさの設定`) };
}

// What the visitor can change for themselves: how big the text and buttons are, and how the map
// shows places. (The developer-only map style page is /settings/map.)
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const home = localePath(i18n.locale);
  const viewer = await getViewer(searchParams);
  const prefs = await getPrefs();

  return (
    <div className="page-narrow flex flex-col gap-6 px-4 pt-2">
      <BackLink href={home}>
        <Trans>ホーム</Trans>
      </BackLink>
      <h1 className="font-serif text-3xl font-bold">
        <Trans>見やすさの設定</Trans>
      </h1>
      <p className="text-lg">
        <Trans>文字やボタンの大きさ、地図の見せ方を選べます。大きさは、選ぶとすぐに変わります。</Trans>
      </p>
      <PrefsForm initial={prefs} signedIn={viewer.signedIn} mode="settings" next={home} />
    </div>
  );
}
