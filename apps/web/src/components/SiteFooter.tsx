import Link from "next/link";
import { Trans } from "@lingui/react/macro";
import { localePath } from "@/lib/rally";

/** The links every page ends with: the questions people ask, the licenses and the privacy policy. */
export function SiteFooter({ locale }: { locale: string }) {
  const link = "tap-target inline-flex items-center text-lg font-bold underline";
  return (
    <footer className="mt-10 flex flex-wrap gap-x-6 gap-y-1 border-t border-line/30 px-4 pt-4">
      <Link href={localePath(locale, "/faq")} className={link}>
        <Trans>よくあるご質問</Trans>
      </Link>
      <Link href={localePath(locale, "/licenses")} className={link}>
        <Trans>ライセンス情報</Trans>
      </Link>
      <Link href={localePath(locale, "/privacy")} className={link}>
        <Trans>プライバシーポリシー</Trans>
      </Link>
    </footer>
  );
}
