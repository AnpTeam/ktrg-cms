"use client";

import { useLingui } from "@lingui/react/macro";
import { useAgeRangeNames, useFoundViaNames, useGenderNames } from "@/components/auth/AboutYou";
import { useOriginNames } from "@/components/auth/authUi";
import { UserIcon } from "@/components/icons";
import { formatPublicId, type AgeRange, type FoundVia, type Gender, type Origin } from "@/lib/auth-flow";

export interface ProfileCardProps {
  publicId: string | null;
  /** When a requested deletion will happen (ISO time); null with no request. */
  deletionDueAt: string | null;
  locale: string;
  name: string | null;
  origin: Origin | null;
  ageRange: AgeRange | null;
  gender: Gender | null;
  foundVia: FoundVia | null;
  /** A smaller card (the menu's). */
  readOnly?: boolean;
  /** The account's email, shown on the profile page; passkey-only accounts have none. */
  email?: string | null;
}

/**
 * Who is signed in, as a card: the name, what they said about themselves, and their ID. Only shows; changing anything and
 * deleting the account happen on the profile page (ProfileSettings). `readOnly` is the small version for the menu.
 */
export function ProfileCard({ publicId, name, origin, ageRange, gender, foundVia, email, readOnly = false }: ProfileCardProps) {
  const { t } = useLingui();
  const originNames = useOriginNames();
  const ageNames = useAgeRangeNames();
  const genderNames = useGenderNames();
  const foundViaNames = useFoundViaNames();
  const text = readOnly ? "text-base" : "text-lg";

  return (
    <section aria-label={t`プロフィール`} className={`mx-4 flex items-center rounded-3xl bg-surface ${readOnly ? "gap-3 p-3" : "gap-4 p-5"}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand text-on-brand ${readOnly ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-7"}`}>
        <UserIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`break-words font-bold leading-snug ${readOnly ? "text-lg" : "text-xl"}`}>{name ?? t`お名前は未設定です`}</p>
        <p className={`text-muted ${text}`}>{origin ? originNames[origin] : t`どちらからかは未設定です`}</p>
        {ageRange || gender ? (
          <p className={`text-muted ${text}`}>
            {ageRange ? ageNames[ageRange] : null}
            {ageRange && gender ? "　" : null}
            {gender ? genderNames[gender] : null}
          </p>
        ) : null}
        {foundVia ? <p className={`text-muted ${text}`}>{foundViaNames[foundVia]}</p> : null}
        {!readOnly && email ? <p className="break-all text-base text-muted">{email}</p> : null}
        {publicId ? <p className={`text-muted ${readOnly ? "text-sm" : "mt-1 text-base"}`}>{t`ID: ${formatPublicId(publicId)}`}</p> : null}
      </div>
    </section>
  );
}
