import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import { localePath } from "@/lib/rally";
import { foundationEn, foundationJa } from "@/lib/terms-content";

/** What every page ends with: the questions people ask, the terms, the licenses, the privacy policy, and who makes the app. */
export function SiteFooter({ locale }: { locale: string }) {
  const { t } = useLingui();
  const link = "tap-target inline-flex items-center text-lg font-bold underline";
  return (
    <footer className="mt-10 border-t border-line/30 px-4 pt-4">
      <nav aria-label={t`フッター`} className="flex flex-wrap gap-x-6 gap-y-1">
      <Link href={localePath(locale, "/faq")} className={link}>
        <Trans>よくあるご質問</Trans>
      </Link>
      <Link href={localePath(locale, "/licenses")} className={link}>
        <Trans>ライセンス情報</Trans>
      </Link>
      <Link href={localePath(locale, "/sitemap")} className={link}>
        <Trans>サイトマップ</Trans>
      </Link>
      <Link href={localePath(locale, "/terms")} className={link}>
        <Trans>利用規約</Trans>
      </Link>
      <Link href={localePath(locale, "/privacy")} className={link}>
        <Trans>プライバシーポリシー</Trans>
      </Link>
      </nav>
      {/* A credit line, kept small: Japanese name on the Japanese pages, English name on the English ones. */}
      <p lang={locale === "ja" ? "ja" : "en"} className="mt-3 text-sm text-muted">
        {locale === "ja" ? foundationJa : foundationEn}
      </p>
    </footer>
  );
}
