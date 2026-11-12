import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { initLingui } from "@/i18n/server";

export default async function NotFound() {
  await initLingui();

  return (
    <div className="flex flex-col gap-6 px-4">
      <h1 className="font-serif text-3xl font-bold text-accent">
        <Trans>ページが見つかりません</Trans>
      </h1>
      <p className="text-xl">
        <Trans>アドレスがちがうか、ページが公開されていません。</Trans>
      </p>
      <ButtonLink href="/">
        <Trans>ホームにもどる</Trans>
      </ButtonLink>
    </div>
  );
}
