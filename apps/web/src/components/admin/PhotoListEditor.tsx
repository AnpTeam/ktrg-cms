"use client";

import { useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { findPlacePhotos, type PhotoCandidate } from "@/lib/admin/place-photos";
import { photoLinkLooksValid } from "@/lib/admin/save-plan";
import { PhotoSlot } from "./PhotoSlot";
import { PhotoUpload } from "./PhotoUpload";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { TextInput } from "./fields";
import { addPhoto, fromList, makeMain, MAX_PHOTOS, movePhoto, patchPhoto, removePhoto, toList, type ListPhoto, type StoredPhotos } from "@/lib/admin/photo-list";

/** A short name for a photo link: the file's name (decoded), not the whole address. */
function photoName(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts.at(-1) ?? "";
    // A Wikimedia thumbnail ends in "<width>px-<file>"; the file's own name is the segment before it.
    const file = /^\d+px-/.test(last) && parts.length > 1 ? parts.at(-2)! : last;
    return decodeURIComponent(file).replace(/_/g, " ");
  } catch {
    return url;
  }
}
const smallButton = "tap-target rounded-full border border-line px-4 text-base font-bold disabled:opacity-40";

/**
 * The photos of one waypoint, in the order visitors see them: the first is the main photo (the one on the place's card and
 * on maps), the rest follow it on the place's page. Each shows the credit that goes under it, and the page it was found on
 * when there is one. Photos are added by uploading a file, by choosing one already uploaded, by link, or by finding one on
 * Wikipedia and Wikimedia Commons (free licenses only, with the photographer and license written into the credit).
 * They are saved with the place.
 */
export function PhotoListEditor({ stored, onChange, name, lat, lng }: { stored: StoredPhotos; onChange: (next: StoredPhotos) => void; name: string; lat: number | null; lng: number | null }) {
  const { t } = useLingui();
  const [link, setLink] = useState("");
  const [found, setFound] = useState<PhotoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const groupName = useId();
  const photos = toList(stored);
  const full = photos.length >= MAX_PHOTOS;
  const set = (next: ListPhoto[]) => onChange({ ...stored, ...fromList(next) });
  const add = (photo: ListPhoto) => set(addPhoto(photos, photo));

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
    <div className="flex flex-col gap-3">
      <p className="text-base text-muted">{t`先頭の写真が、この経由地のメイン写真です。ほかの写真は、この経由地のページに順に並びます。他の人が撮った写真は、撮った人と使用条件を、「出どころ」に書いてください。`}</p>

      {photos.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {photos.map((p, i) => (
            <li key={p.url} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-3 sm:flex-row">
              <PhotoSlot url={p.url} className="sm:w-40 sm:shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="truncate text-base font-bold" title={p.url}>
                  {photoName(p.url)}
                </p>
                {p.sourceUrl ? (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="w-fit text-base font-bold underline underline-offset-4">
                    {t`元のページ`}
                  </a>
                ) : null}
                <label htmlFor={`${groupName}-credit-${i}`} className="text-base text-muted">
                  {t`出どころ（撮った人、使用条件）`}
                </label>
                <TextInput id={`${groupName}-credit-${i}`} value={p.credit ?? ""} onChange={(v) => set(patchPhoto(photos, i, { credit: v }))} maxLength={300} placeholder={t`例：山田太郎, CC BY-SA 4.0`} />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={i === 0} onClick={() => set(movePhoto(photos, i, -1))} aria-label={t`前へ`} className={smallButton}>
                    <ArrowUpIcon size={22} />
                  </button>
                  <button type="button" disabled={i === photos.length - 1} onClick={() => set(movePhoto(photos, i, 1))} aria-label={t`後ろへ`} className={smallButton}>
                    <ArrowDownIcon size={22} />
                  </button>
                  <button type="button" onClick={() => set(removePhoto(photos, i))} className="tap-target rounded-full border border-danger px-4 text-base font-bold text-danger">
                    {t`外す`}
                  </button>
                  <label className="tap-target ml-auto inline-flex items-center gap-2 text-base font-bold">
                    <input type="radio" name={`${groupName}-main`} checked={i === 0} onChange={() => set(makeMain(photos, i))} className="size-5 accent-[var(--color-brand)]" />
                    {t`メイン写真`}
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-base">{t`写真は、まだありません。`}</p>
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
      <PhotoUpload onUploaded={(url) => add({ url, credit: null, sourceUrl: null })} disabled={full} />
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
    </div>
  );
}
