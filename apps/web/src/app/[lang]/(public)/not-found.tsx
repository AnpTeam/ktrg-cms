import { Trans } from "@lingui/react/macro";
import { ButtonLink } from "@/components/ButtonLink";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

export default async function NotFound() {
  const i18n = await initLingui();

  return (
    <div className="flex flex-col gap-6 px-4">
      <h1 className="text-3xl font-bold">
        <Trans>ページが見つかりません</Trans>
      </h1>
      <p className="text-xl">
        <Trans>アドレスがちがうか、ページが公開されていません。</Trans>
      </p>
      <ButtonLink href={localePath(i18n.locale)}>
        <Trans>ホームにもどる</Trans>
      </ButtonLink>
    </div>
  );
}
