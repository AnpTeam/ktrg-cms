import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { WelcomeFlow } from "@/components/settings/WelcomeFlow";
import { initLingui } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth-flow";
import { getPrefs } from "@/lib/server-prefs";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`はじめての設定`) };
}

// The first screens after registering: a few optional questions about you (age band, gender), then how big
// things should be and how the map shows places, with big plain buttons, then go on. Everything here can be
// changed later.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string; as?: string }> }) {
  await initLingui();
  const params = await searchParams;
  const next = safeNextPath(params.next, "/");
  const viewer = await getViewer(searchParams);
  const prefs = await getPrefs();

  return (
    <div className="page-narrow flex flex-col gap-6 px-4 pt-2">
      <WelcomeFlow initial={prefs} signedIn={viewer.signedIn} next={next} askAbout={viewer.ageRange === null && viewer.gender === null} />
    </div>
  );
}
