import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { ChevronIcon } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import { ProfileCard } from "@/components/ProfileCard";
import { FeaturedRally, RallyCard } from "@/components/RallyViews";
import { SectionBanner } from "@/components/SectionBanner";
import { SignInPrompt } from "@/components/SignInPrompt";
import { listRallies } from "@/lib/content";
import { forRallyViewer, otherRallies, pickFeatured } from "@/lib/rally-model";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

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
    <div className="flex flex-col gap-6 pt-2 lg:pt-0">
      {/* From 1024 px: you and how to play on the left, the rallies on the right. On a phone, one column in this order. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-x-10">
      <div className="flex flex-col gap-6">
      <h1 className="px-4 text-3xl font-bold lg:text-4xl">
        <Trans>スタンプ</Trans>
      </h1>

      {/* How to play lives here, with the stamps, and nowhere else. */}
      <Link
        href={localePath(i18n.locale, "/guide")}
        className="tap-target mx-4 flex items-center justify-between rounded-2xl bg-surface px-5 text-xl font-bold text-accent"
      >
        <Trans>遊び方</Trans>
        <ChevronIcon />
      </Link>

      {/* Signed out: a reason to sign in and the rallies, never a false "0 stamps". */}
      {viewer.signedIn ? <ProfileCard publicId={viewer.publicId} deletionDueAt={viewer.deletionDueAt} locale={i18n.locale} name={viewer.name} origin={viewer.origin} ageRange={viewer.ageRange} gender={viewer.gender} /> : <SignInPrompt />}

      </div>

      <div className="flex flex-col gap-6">
      {rallies.length === 0 ? (
        <EmptyState title={<Trans>ラリーは、まだ準備中です。</Trans>}>
          <Trans>公開できるようになったら、ここにスタンプのラリーが表示されます。</Trans>
        </EmptyState>
      ) : null}

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

      </div>
      </div>

      <Notice>
        <Trans>出かける前に、公式の最新情報を確認してください。</Trans>
      </Notice>
    </div>
  );
}
