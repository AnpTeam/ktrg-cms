import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { LoginMethods } from "@/components/settings/LoginMethods";
import { SignInPrompt } from "@/components/SignInPrompt";
import { initLingui } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ログインの方法`) };
}

// The passkeys of the signed-in account (WBS 3.1.8, 3.3.5): see them, add this phone's, remove one.
export default async function PasskeysPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);

  return (
    <div className="page-narrow flex flex-col gap-6 px-4 pt-2">
      <BackLink href="/profile">
        <Trans>プロフィール</Trans>
      </BackLink>
      <h1 className="text-3xl font-bold">
        <Trans>ログインの方法</Trans>
      </h1>
      {viewer.signedIn ? (
        <>
          <p className="text-lg">
            <Trans>パスキーは、顔や指紋でログインするための鍵です。この端末のものを追加すると、メールを待たずにログインできます。</Trans>
          </p>
          <LoginMethods locale={i18n.locale} />
        </>
      ) : (
        <SignInPrompt />
      )}
    </div>
  );
}
