import { Trans } from "@lingui/react/macro";
import { ProfileCard } from "@/components/ProfileCard";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SignInPrompt } from "@/components/SignInPrompt";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

// The profile, reached from the menu: who is signed in, the answers they gave (changed one at a time), the ways to log in,
// and deleting the account.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  return (
    <div className="flex flex-col gap-6 pt-2 lg:pt-0">
      <h1 className="px-4 text-3xl font-bold lg:text-4xl">
        <Trans>プロフィール</Trans>
      </h1>
      {viewer.signedIn ? (
        <>
          <ProfileCard publicId={viewer.publicId} deletionDueAt={viewer.deletionDueAt} locale={i18n.locale} name={viewer.name} origin={viewer.origin} ageRange={viewer.ageRange} gender={viewer.gender} foundVia={viewer.foundVia} email={viewer.email} />
          {viewer.role === "editor" || viewer.role === "admin" ? <ProfilePhoto photoUrl={viewer.avatarUrl ?? null} name={viewer.name} /> : null}
          <ProfileSettings locale={i18n.locale} deletionDueAt={viewer.deletionDueAt} name={viewer.name} origin={viewer.origin} ageRange={viewer.ageRange} gender={viewer.gender} foundVia={viewer.foundVia} />
        </>
      ) : (
        <SignInPrompt />
      )}
    </div>
  );
}
