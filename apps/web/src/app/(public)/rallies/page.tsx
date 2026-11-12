import type { Metadata } from "next";
import Link from "next/link";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import { FeaturedRally, RallyCard, RallyHero } from "@/components/RallyViews";
import { SectionBanner } from "@/components/SectionBanner";
import { SignInPrompt } from "@/components/SignInPrompt";
import { listRallies } from "@/lib/content";
import { otherRallies, pickFeatured } from "@/lib/rally-model";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

// The rally page (the stamps live inside each rally): the rally you stamped in most recently (with how many
// are left), and below it every other published rally. The rallies come from GET /rallies; sample content stands in only
// in development when none are published.
export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`ラリー`) };
}

export default async function StampsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const i18n = await initLingui();
  const [viewer, rallies] = await Promise.all([getViewer(searchParams), listRallies()]);
  const featured = pickFeatured(rallies);
  const others = otherRallies(rallies, featured);

  return (
    <div className="flex flex-col gap-6 pt-2 wide:pt-0">
      {/* One column in this order, on a phone and on a desktop alike: the title, you, the rally you are in, then the rest as cards side by side. */}
      {/* The title, with the badges and how to play to its side ("?"): how to play lives here, with the stamps, and nowhere else. */}
      {/* On a phone the top bar carries the title (as on the course list); the heading stays for screen readers and a wider page. */}
      <div className="flex items-center justify-end gap-3 px-4 md:justify-start">
        <h1 className="min-w-0 flex-1 font-serif text-3xl font-bold text-accent wide:text-4xl sr-only md:not-sr-only">
          <Trans>ラリー</Trans>
        </h1>
        <Link href="/badges" className="tap-target inline-flex items-center rounded-full bg-surface px-5 text-xl font-bold text-accent">
          <Trans>バッジ</Trans>
        </Link>
        <Link
          href="/guide"
          aria-label={i18n._(msg`遊び方`)}
          className="tap-target inline-flex size-12 items-center justify-center rounded-full bg-surface text-2xl font-bold text-accent"
        >
          ?
        </Link>
      </div>

      <RallyHero />

      {/* Signed out: a reason to sign in and the rallies, never a false "0 stamps". */}
      {viewer.signedIn ? null : <SignInPrompt compact />}
      {rallies.length === 0 ? (
        <EmptyState title={<Trans>ラリーは、まだ準備中です。</Trans>}>
          <Trans>公開できるようになったら、ここにスタンプのラリーが表示されます。</Trans>
        </EmptyState>
      ) : null}

      {featured ? <FeaturedRally rally={featured} locale={i18n.locale} account={viewer.signedIn} /> : null}

      {others.length > 0 ? (
        <section className="flex flex-col gap-3 px-4">
          <SectionBanner>
            <Trans>ラリーの一覧</Trans>
          </SectionBanner>
          <ul className="grid gap-3 wide:grid-cols-2 wide:gap-4">
            {others.map((rally) => (
              <RallyCard key={rally.id} rally={rally} locale={i18n.locale} account={viewer.signedIn} />
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
