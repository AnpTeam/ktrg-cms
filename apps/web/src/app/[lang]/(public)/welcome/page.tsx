import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PrefsForm } from "@/components/settings/PrefsForm";
import { initLingui } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth-flow";
import { localePath } from "@/lib/rally";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`はじめての設定`) };
}

// The first screen after registering: pick how big things should be and how the map shows places,
// with big plain buttons, then go on. Everything here can be changed later in the menu.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string; as?: string }> }) {
  const i18n = await initLingui();
  const params = await searchParams;
  const next = safeNextPath(params.next, localePath(i18n.locale));
  const viewer = await getViewer(searchParams);
  const prefs = await getPrefs();

  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <h1 className="font-serif text-3xl font-bold">
        <Trans>登録ありがとうございます</Trans>
      </h1>
      <p className="text-lg">
        <Trans>見やすさを、あなたに合わせましょう。大きさは、選ぶとすぐに変わります。</Trans>
      </p>
      <PrefsForm initial={prefs} signedIn={viewer.signedIn} mode="setup" next={next} />
    </div>
  );
}
