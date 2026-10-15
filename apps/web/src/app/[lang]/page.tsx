import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";

// Placeholder until the (public) route group pages are built.
export default async function HomePage() {
  await initLingui();

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold">
        <Trans>葛城修験</Trans>
      </h1>
      <p className="text-lg">
        <Trans>準備中です。</Trans>
      </p>
    </div>
  );
}
