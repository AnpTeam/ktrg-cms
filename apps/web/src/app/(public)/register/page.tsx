import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { RegisterFlow } from "@/components/auth/RegisterFlow";
import { safeNextPath } from "@/lib/auth-flow";
import { getViewer } from "@/lib/viewer";
import { initLingui } from "@/i18n/server";

type Props = { searchParams: Promise<{ next?: string; as?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`新規登録`) };
}

export default async function RegisterPage({ searchParams }: Props) {
  await initLingui();
  const [params, viewer] = await Promise.all([searchParams, getViewer(searchParams)]);
  const home = "/";
  const next = safeNextPath(params.next, home);
  if (viewer.signedIn) redirect(next);

  return (
    <div className="page-form flex flex-col gap-6 px-4">
      <BackLink href={home}>
        <Trans>ホーム</Trans>
      </BackLink>
      <h1 className="text-3xl font-bold">
        <Trans>新規登録</Trans>
      </h1>
      <div className="frame pattern-shippo p-5">
        <RegisterFlow next={next} loginHref={`/login?next=${encodeURIComponent(next)}`} />
      </div>
    </div>
  );
}
