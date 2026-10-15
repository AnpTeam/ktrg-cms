import { Trans } from "@lingui/react/macro";
import { StampFace } from "./StampFace";

/**
 * Shown to a signed-out visitor where progress would be. It explains what an account is
 * for and reassures that browsing needs none. TODO(WBS 3.1.1): add the sign-in button
 * when the login page exists; until then there is no control, because a button to a
 * missing page would be worse than none.
 */
export function SignInPrompt() {
  return (
    <section className="mx-4 flex items-start gap-4 rounded-xl border-2 border-line bg-surface p-4">
      <StampFace state="empty" className="h-12 w-12 shrink-0" />
      <div className="text-lg">
        <p className="font-bold">
          <Trans>ログインすると、スタンプを記録できます。</Trans>
        </p>
        <p className="mt-1 text-muted">
          <Trans>ルートや場所は、ログインしなくても見られます。</Trans>
        </p>
      </div>
    </section>
  );
}
