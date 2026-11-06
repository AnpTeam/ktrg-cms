import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RestoreStamps } from "@/components/RestoreStamps";
import { initLingui } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`スタンプをもどす`) };
}

// Where a backup link (see GuestBackup) leads: it puts the stamps it holds back into this browser.
export default async function RestorePage() {
  await initLingui();
  return (
    <div className="flex flex-col gap-6 pt-2 wide:pt-0">
      <h1 className="px-4 text-3xl font-bold wide:text-4xl">
        <Trans>スタンプをもどす</Trans>
      </h1>
      <RestoreStamps />
    </div>
  );
}
