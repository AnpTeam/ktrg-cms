import { Trans } from "@lingui/react/macro";
import { Notice } from "@/components/Notice";
import { ProfileCard } from "@/components/ProfileCard";
import { FeaturedRally, RallyCard } from "@/components/RallyViews";
import { SectionBanner } from "@/components/SectionBanner";
import { SignInPrompt } from "@/components/SignInPrompt";
import { listRallies } from "@/lib/content";
import { forRallyViewer, otherRallies, pickFeatured } from "@/lib/rally-model";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

// The stamp page: who you are, the rally you stamped in most recently (with how many are left), and
// below it every other rally: the 31 sutra mound places as one rally and one rally for each course.
// Until accounts and the stamp API exist the rallies come from sample content (development only).
export default async function StampsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const viewer = await getViewer(searchParams);
  const rallies = (await listRallies()).map((r) => forRallyViewer(r, viewer.signedIn));
  const featured = pickFeatured(rallies);
  const others = otherRallies(rallies, featured);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="px-4 text-3xl font-bold">
        <Trans>スタンプ</Trans>
      </h1>

      {/* Signed out: a reason to sign in and the rallies, never a false "0 stamps". */}
      {viewer.signedIn ? <ProfileCard name={viewer.name} origin={viewer.origin} /> : <SignInPrompt />}

      {featured ? <FeaturedRally rally={featured} locale={i18n.locale} signedIn={viewer.signedIn} /> : null}

      {others.length > 0 ? (
        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>
            <Trans>ラリーの一覧</Trans>
          </SectionBanner>
          <ul className="flex flex-col gap-3">
            {others.map((rally) => (
              <RallyCard key={rally.id} rally={rally} locale={i18n.locale} signedIn={viewer.signedIn} />
            ))}
          </ul>
        </section>
      ) : null}

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}
