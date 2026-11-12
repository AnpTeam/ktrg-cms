"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { Avatar } from "@/components/blog/Avatar";
import { api } from "@/lib/api";

/**
 * The profile photo of a staff member: it is the picture by the byline of the blog posts they write. Choosing a photo saves it
 * at once (PATCH /me). Only the staff see this: the photo goes through the staff's upload endpoint.
 */
export function ProfilePhoto({ photoUrl, name }: { photoUrl: string | null; name: string | null }) {
  const { t } = useLingui();
  const router = useRouter();
  const [url, setUrl] = useState(photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function save(next: string | null) {
    setBusy(true);
    setError(false);
    const res = await api.me.patch({ avatarUrl: next } as never);
    setBusy(false);
    if (res.error) return setError(true);
    setUrl(next);
    router.refresh();
  }

  return (
    <section aria-labelledby="profile-photo-title" className="mx-4 flex flex-col gap-3 rounded-[1.75rem] bg-surface p-5">
      <h2 id="profile-photo-title" className="border-l-4 border-brand pl-3 font-serif text-xl font-bold text-accent">
        {t`プロフィール写真`}
      </h2>
      <p className="text-base text-muted">{t`ブログの記事の、書いた人のところに表示されます。`}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={url} name={name} size={72} />
        <div className="flex flex-col gap-2">
          <PhotoUpload onUploaded={(u) => void save(u)} disabled={busy} />
          {url ? (
            <button type="button" disabled={busy} onClick={() => void save(null)} className="tap-target w-fit text-base font-bold text-danger underline">
              {t`写真を外す`}
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {t`保存できませんでした。もう一度お試しください。`}
        </p>
      ) : null}
    </section>
  );
}
