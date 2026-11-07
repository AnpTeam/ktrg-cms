import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ProfileCard } from "@/components/ProfileCard";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SignInPrompt } from "@/components/SignInPrompt";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { buttonStyle } from "@/components/button";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`プロフィール`) };
}

// The profile, reached from the menu: who is signed in, the answers they gave (changed one at a time), the ways to log in,
// and deleting the account.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  return (
    <div className="flex flex-col gap-6 pt-2 wide:pt-0">
      <h1 className="px-4 text-3xl font-bold wide:text-4xl">
        <Trans>プロフィール</Trans>
      </h1>
      {viewer.signedIn ? (
        <>
          <ProfileCard publicId={viewer.publicId} deletionDueAt={viewer.deletionDueAt} locale={i18n.locale} name={viewer.name} origin={viewer.origin} originPlace={viewer.originPlace} ageRange={viewer.ageRange} gender={viewer.gender} foundVia={viewer.foundVia} email={viewer.email} />
          {viewer.role === "editor" || viewer.role === "admin" ? (
            <>
              <Link prefetch={false} href="/admin" className={buttonStyle("primary", "lg", "mx-4 flex")}>
                <Trans>管理画面を開く</Trans>
              </Link>
              <ProfilePhoto photoUrl={viewer.avatarUrl ?? null} name={viewer.name} />
            </>
          ) : null}
          <ProfileSettings locale={i18n.locale} deletionDueAt={viewer.deletionDueAt} deletionByAdmin={viewer.deletionByAdmin ?? false} deletionAppeal={viewer.deletionAppeal ?? null} name={viewer.name} origin={viewer.origin} originPlace={viewer.originPlace} ageRange={viewer.ageRange} gender={viewer.gender} foundVia={viewer.foundVia} />
        </>
      ) : (
        <SignInPrompt />
      )}
    </div>
  );
}
