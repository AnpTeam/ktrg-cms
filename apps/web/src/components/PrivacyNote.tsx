"use client";

import Link from "next/link";
import { Trans, useLingui } from "@lingui/react/macro";

/**
 * One plain sentence next to every question about the person: what the answers are used for, that they are
 * optional, and where the full policy is. Shown wherever we ask (register, the about-you step, the profile).
 */
export function PrivacyNote() {
  const { i18n } = useLingui();
  return (
    <p className="rounded-2xl bg-surface p-4 text-base leading-7">
      <Trans>
        いただいた情報は、どんな方がこのアプリを使っているかを知るためだけに使います。個人が分からない形でまとめます。くわしくは
        <Link href={`/${i18n.locale}/privacy`} className="font-bold underline">
          プライバシーポリシー
        </Link>
        をご覧ください。
      </Trans>
    </p>
  );
}
