import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";
import { foundationEn, foundationJa } from "@/lib/terms-content";

/**
 * What every page ends with: the questions people ask, the terms, the licenses, the privacy policy, and who makes the
 * app. On a desktop (`variant="sidebar"`) the same links sit at the bottom of the sidebar, stacked and compact, so they
 * are always in view. Both carry the `site-footer` class: the map page hides them (it is the whole screen).
 */
export function SiteFooter({ locale, variant = "page" }: { locale: string; variant?: "page" | "sidebar" }) {
  const { t } = useLingui();
  const sidebar = variant === "sidebar";
  const link = sidebar ? "inline-flex items-center py-1 text-base font-bold underline" : "tap-target inline-flex items-center text-lg font-bold underline";
  return (
    <footer className={sidebar ? "print:hidden site-footer border-t border-line/30 px-2 pt-3" : "print:hidden site-footer mt-10 border-t border-line/30 px-4 pt-4"}>
      <nav aria-label={t`フッター`} className={sidebar ? "flex flex-col" : "flex flex-wrap gap-x-6 gap-y-1"}>
        <Link prefetch={false} href="/faq" className={link}>
          <Trans>よくあるご質問</Trans>
        </Link>
        <Link prefetch={false} href="/licenses" className={link}>
          <Trans>ライセンス情報</Trans>
        </Link>
        <Link prefetch={false} href="/sitemap" className={link}>
          <Trans>サイトマップ</Trans>
        </Link>
        <Link prefetch={false} href="/terms" className={link}>
          <Trans>利用規約</Trans>
        </Link>
        <Link prefetch={false} href="/privacy" className={link}>
          <Trans>プライバシーポリシー</Trans>
        </Link>
      </nav>
      {/* A credit line, kept small: Japanese name on the Japanese pages, English name on the English ones. */}
      <p lang={locale === "ja" ? "ja" : "en"} className={`text-sm text-muted ${sidebar ? "mt-2 whitespace-pre-line" : "mt-3"}`}>
        {/* In the narrow sidebar the legal form (一般財団法人) sits on its own line above the name. */}
        {locale !== "ja" ? foundationEn : sidebar ? foundationJa.replace(/^一般財団法人/, "一般財団法人\n") : foundationJa}
      </p>
    </footer>
  );
}
