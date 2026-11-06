import type { Metadata } from "next";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PasswordUndo } from "@/components/auth/PasswordUndo";
import { initLingui } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initLingui();
  return { title: i18n._(msg`パスワードの変更を取り消す`), robots: { index: false } };
}

export default async function PasswordUndoPage() {
  await initLingui();
  return (
    <div className="page-form flex flex-col gap-6 px-4">
      <h1 className="font-serif text-3xl font-bold">
        <Trans>パスワードの変更を取り消す</Trans>
      </h1>
      <div className="frame p-5">
        <PasswordUndo />
      </div>
    </div>
  );
}
