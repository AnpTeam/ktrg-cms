"use client";

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { GalleryPhoto } from "@/lib/content";
import { findPlacePhotos, type PhotoCandidate } from "@/lib/admin/place-photos";
import { photoLinkLooksValid } from "@/lib/admin/save-plan";
import { PhotoSlot } from "./PhotoSlot";
import { TextInput } from "./fields";

const MAX_PHOTOS = 12;
const smallButton = "tap-target rounded-xl border-2 border-line px-4 text-base font-bold disabled:opacity-40";

/**
 * The gallery of one waypoint: the photos in the order visitors see them, each with the credit that goes under it.
 * Photos are added by link, or found on Wikipedia and Wikimedia Commons (free licenses only, with the photographer and
 * license written into the credit). Photos are saved with the place.
 */
export function GalleryEditor({ photos, onChange, name, lat, lng }: { photos: GalleryPhoto[]; onChange: (photos: GalleryPhoto[]) => void; name: string; lat: number | null; lng: number | null }) {
  const { t } = useLingui();
  const [link, setLink] = useState("");
  const [found, setFound] = useState<PhotoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const full = photos.length >= MAX_PHOTOS;

  const add = (photo: GalleryPhoto) => {
    if (photos.some((p) => p.url === photo.url)) return;
    onChange([...photos, photo]);
  };
  const patch = (i: number, change: Partial<GalleryPhoto>) => onChange(photos.map((p, j) => (j === i ? { ...p, ...change } : p)));
  const move = (i: number, step: -1 | 1) => {
    const next = [...photos];
    const [one] = next.splice(i, 1);
    next.splice(i + step, 0, one!);
    onChange(next);
  };

  async function search() {
    setSearching(true);
    setNote(null);
    setFound(null);
    try {
      // Without a position the place is looked up by its name alone, and only the best match is offered.
      const hits = await findPlacePhotos({ name, lat: lat ?? 0, lng: lng ?? 0, uncertain: lat === null || lng === null }, { limit: 6 });
      setFound(hits);
      if (hits.length === 0) setNote(t`使える写真は見つかりませんでした。`);
    } catch {
      setNote(t`写真を探すサービスにつながりませんでした。しばらくしてから、もう一度お試しください。`);
    }
    setSearching(false);
  }

  const credit = (c: PhotoCandidate) => [c.author, c.license].filter(Boolean).join(", ");

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-bold">{t`写真（ギャラリー）`}</legend>
      <p className="text-base text-muted">{t`ここの写真は、この経由地のページに順に並びます。他の人が撮った写真は、撮った人と使用条件を、下の「出どころ」に書いてください。`}</p>

      {photos.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {photos.map((p, i) => (
            <li key={p.url} className="flex flex-col gap-2 rounded-xl border border-line bg-paper p-3 sm:flex-row">
              <PhotoSlot url={p.url} className="sm:w-48 sm:shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="break-all text-base text-muted">{p.url}</p>
                <TextInput id={`gallery-credit-${i}`} value={p.credit ?? ""} onChange={(v) => patch(i, { credit: v.trim() === "" ? null : v })} maxLength={300} placeholder={t`出どころ（撮った人、使用条件）`} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className={smallButton}>
                    {t`前へ`}
                  </button>
                  <button type="button" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className={smallButton}>
                    {t`後ろへ`}
                  </button>
                  <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} className="tap-target rounded-xl border-2 border-danger px-4 text-base font-bold text-danger">
                    {t`外す`}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-base">{t`ギャラリーの写真は、まだありません。`}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TextInput id="gallery-link" value={link} onChange={setLink} maxLength={500} placeholder="https://" />
        <button
          type="button"
          disabled={full || !photoLinkLooksValid(link)}
          onClick={() => {
            add({ url: link.trim(), credit: null, sourceUrl: null });
            setLink("");
          }}
          className={smallButton}
        >
          {t`リンクで追加`}
        </button>
        <button type="button" disabled={full || searching || name.trim() === ""} onClick={search} className={smallButton}>
          {searching ? t`探しています…` : t`WikipediaやWikimedia Commonsから探す`}
        </button>
      </div>
      {full ? <p className="text-base text-muted">{t`写真は${MAX_PHOTOS}枚までです。`}</p> : null}
      {note ? <p role="status" className="text-base font-bold">{note}</p> : null}

      {found && found.length > 0 ? (
        <ul aria-label={t`見つかった写真`} className="grid gap-3 sm:grid-cols-2">
          {found.map((c) => (
            <li key={c.title} className="flex flex-col gap-2 rounded-xl border border-line bg-paper p-3">
              <PhotoSlot url={c.downloadUrl} />
              <p className="text-base">{credit(c) || c.title}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={full || photos.some((p) => p.url === c.downloadUrl)} onClick={() => add({ url: c.downloadUrl, credit: credit(c) || null, sourceUrl: c.url })} className={smallButton}>
                  {photos.some((p) => p.url === c.downloadUrl) ? t`追加しました` : t`追加する`}
                </button>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center text-base font-bold underline underline-offset-4">
                  {t`元のページ`}
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
