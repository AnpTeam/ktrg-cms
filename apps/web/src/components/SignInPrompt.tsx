import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { GuestBackup } from "./GuestBackup";
import { StampFace } from "./StampFace";

/**
 * Shown to a visitor with no account, where progress would be. Stamps work without one (they are kept in this browser), so
 * it explains what an account adds (they are not lost, and there is a certificate) and offers the two ways in.
 * `compact` (the long lists) keeps to the one line and the two buttons, so the list is not pushed off the first screen; the
 * explanation and the backup link are on the profile page.
 */
export async function SignInPrompt({ compact = false }: { compact?: boolean }) {
  await initLingui();
  if (compact) {
    return (
      <section className="mx-4 flex flex-col gap-3 rounded-3xl bg-surface p-4">
        <p className="text-lg font-bold">
          <Trans>登録しなくても、スタンプは押せます。</Trans>
        </p>
        <div className="flex gap-3">
          <Link href="/register" className="tap-target flex min-h-12 flex-1 items-center justify-center rounded-xl bg-ink px-4 text-lg font-bold text-paper">
            <Trans>新規登録</Trans>
          </Link>
          <Link href="/login" className="tap-target flex min-h-12 flex-1 items-center justify-center rounded-xl border border-ink px-4 text-lg font-bold text-ink hover:bg-paper">
            <Trans>ログイン</Trans>
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-4 flex flex-col gap-4 rounded-3xl bg-surface p-5">
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
          className="tap-target flex min-h-14 items-center justify-center rounded-xl bg-ink px-6 text-xl font-bold text-paper"
        >
          <Trans>新規登録</Trans>
        </Link>
        <Link
          href="/login"
          className="tap-target flex min-h-14 items-center justify-center rounded-xl border border-ink px-6 text-xl font-bold text-ink hover:bg-surface"
        >
          <Trans>ログイン</Trans>
        </Link>
      </div>
      <GuestBackup />
    </section>
  );
}
