import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { LoginFlow } from "@/components/auth/LoginFlow";
import { safeNextPath } from "@/lib/auth-flow";
import { localePath } from "@/lib/rally";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

type Props = { searchParams: Promise<{ next?: string; as?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ログイン`) };
}

export default async function LoginPage({ searchParams }: Props) {
  const i18n = await initLingui();
  const params = await searchParams;
  const home = localePath(i18n.locale);
  const next = safeNextPath(params.next, home);
  // Already signed in: nothing to do here.
  if ((await getViewer(searchParams)).signedIn) redirect(next);

  return (
    <div className="flex flex-col gap-6 px-4">
      <BackLink href={home}>
        <Trans>ホーム</Trans>
      </BackLink>
      <h1 className="text-3xl font-bold">
        <Trans>ログイン</Trans>
      </h1>
      <LoginFlow next={next} registerHref={`${localePath(i18n.locale, "/register")}?next=${encodeURIComponent(next)}`} />
    </div>
  );
}
