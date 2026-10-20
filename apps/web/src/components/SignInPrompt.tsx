import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { initLingui } from "@/i18n/server";
import { StampFace } from "./StampFace";

/**
 * Shown to a signed-out visitor where progress would be. It explains what an account is
 * for, reassures that browsing needs none, and offers the two ways in.
 */
export async function SignInPrompt() {
  await initLingui();
  return (
    <section className="mx-4 flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <div className="flex items-start gap-4">
        <StampFace state="empty" className="h-12 w-12 shrink-0" />
        <div className="text-lg">
          <p className="font-bold">
            <Trans>ログインすると、スタンプを記録できます。</Trans>
          </p>
          <p className="mt-1 text-muted">
            <Trans>ルートや場所は、ログインしなくても見られます。</Trans>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          href={"/register"}
          className="tap-target flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-xl font-bold text-on-brand"
        >
          <Trans>新規登録</Trans>
        </Link>
        <Link
          href={"/login"}
          className="tap-target flex min-h-14 items-center justify-center rounded-xl border-2 border-ink px-6 text-xl font-bold text-ink hover:bg-surface"
        >
          <Trans>ログイン</Trans>
        </Link>
      </div>
    </section>
  );
}
