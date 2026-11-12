import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { Dismissible } from "./Dismissible";
import { GuestBackup } from "./GuestBackup";
import { StampFace } from "./StampFace";
import { buttonStyle } from "@/components/button";

/**
 * Shown to a visitor with no account, where progress would be. Stamps work without one (they are kept in this browser), so
 * it explains what an account adds (they are not lost, and there is a certificate) and offers the two ways in.
 * `compact` (the long lists) keeps to two plain links in a soft box the visitor can close (no sentence, no buttons), so the list is not pushed off the first screen; the
 * explanation and the backup link are on the profile page.
 */
export async function SignInPrompt({ compact = false }: { compact?: boolean }) {
  await initLingui();
  if (compact) {
    return (
      <section className="mx-4 rounded-[1.75rem] bg-surface px-5">
        <Dismissible storageKey="ktrg-signin-prompt-closed">
          <p className="flex flex-wrap items-center gap-x-4 text-lg font-bold">
            <Link href="/register" className="tap-target inline-flex items-center underline underline-offset-4">
              <Trans>新規登録</Trans>
            </Link>
            <Link href="/login" className="tap-target inline-flex items-center underline underline-offset-4">
              <Trans>ログイン</Trans>
            </Link>
          </p>
        </Dismissible>
      </section>
    );
  }
  return (
    <section className="mx-4 flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5">
      <div className="flex items-start gap-4">
        <StampFace state="empty" className="h-12 w-12 shrink-0" />
        <div className="text-lg">
          <p className="font-bold">
            <Trans>登録しなくても、スタンプは押せます。</Trans>
          </p>
          <p className="mt-1 text-muted">
            <Trans>ただし、この端末にしか残りません。登録すると、なくならず、コンプリート証ももらえます。</Trans>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          href="/register"
          className={buttonStyle("primary", "lg", "flex")}
        >
          <Trans>新規登録</Trans>
        </Link>
        <Link
          href="/login"
          className={buttonStyle("secondary", "lg", "flex")}
        >
          <Trans>ログイン</Trans>
        </Link>
      </div>
      <GuestBackup />
    </section>
  );
}
