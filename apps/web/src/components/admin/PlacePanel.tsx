"use client";

import { useLingui } from "@lingui/react/macro";
import { pointKinds, stampableByDefault, type PointKind } from "@/lib/point-kinds";
import { publishBlockers, type PlaceDraft, type PublishBlocker } from "@/lib/admin/route-draft";
import type { SpotStatus } from "@/lib/admin/types";
import { Check, Field, inputClass, MultilingualField, NumberInput, TextInput } from "./fields";
import { GalleryEditor } from "./GalleryEditor";
import { PhotoSlot } from "./PhotoSlot";

export interface PlacePanelProps {
  place: PlaceDraft;
  number: number;
  selected: boolean;
  /** True when this place has changes that are not saved yet. */
  dirty: boolean;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  invalidName: boolean;
  invalidPhoto: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<PlaceDraft>) => void;
  onRemove: () => void;
  onMove: (step: -1 | 1) => void;
  onPublish: () => void;
  onUnpublish: () => void;
}

/** The words for what a waypoint can be. */
export function useKindLabels(): Record<PointKind, string> {
  const { t } = useLingui();
  return {
    temple: t`寺社`,
    mound: t`経塚`,
    turn: t`曲がり角`,
    danger: t`危険な所`,
    view: t`見どころ`,
    toilet: t`トイレ`,
    rest_area: t`休憩所`,
    drinking_water: t`水場`,
    vending_machine: t`自動販売機`,
    bus_stop: t`バス停`,
    station: t`駅`,
    parking: t`駐車場`,
    other: t`その他`,
  };
}

/**
 * One place on the route. The short form (name, text, photo, position, kind) is what most edits need; the stamp
 * settings (range, status, permission) are folded away. What still stops it being published is always visible.
 */
export function PlacePanel(p: PlacePanelProps) {
  const { t } = useLingui();
  const { place } = p;
  const blockers = publishBlockers(place, p.dirty);
  const kindName = useKindLabels();
  const isStamp = place.stampable;
  const blockerText: Record<PublishBlocker, string> = {
    unsaved: t`先に「保存」してください。`,
    no_coordinates: t`位置を決めてください（地図に置くか、緯度と経度を入れます）。`,
    position_not_verified: t`位置を公式の情報で確認し、「位置を確認した」にチェックを入れて情報源を書いてください。`,
    permission_required: t`現地の許可を確認し、「許可確認済み」にチェックを入れてください。`,
  };
  const statusName: Record<SpotStatus, string> = { open: t`通常`, caution: t`注意`, closed: t`通行止め` };
  const id = `place-${place.key}`;

  return (
    <li className={`rounded-2xl border-2 ${p.selected ? "border-ink" : "border-line"} bg-paper`}>
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand">
          {p.number}
        </span>
        <button type="button" onClick={p.onSelect} aria-expanded={p.selected} className="min-w-0 flex-1 text-left text-xl font-bold text-accent underline underline-offset-4">
          {place.nameJa || t`（名前がありません）`}
        </button>
        <span className="rounded-lg bg-surface px-3 py-1 text-base">{kindName[place.kind]}</span>
        <span className={`rounded-lg px-3 py-1 text-base font-bold ${place.published ? "bg-moss text-paper" : "bg-surface text-ink"}`}>{place.published ? t`公開中` : t`下書き`}</span>
        {p.dirty ? <span className="text-base font-bold text-accent">{t`未保存`}</span> : null}
        {!place.published && !p.selected && blockers.filter((b) => b !== "unsaved").length > 0 ? (
          <p className="w-full pl-[3.25rem] text-base text-muted">{t`公開まで、あと${blockers.filter((b) => b !== "unsaved").length}つ`}</p>
        ) : null}
      </div>

      {p.selected ? (
        <div className="flex flex-col gap-5 border-t border-line p-4">
          <MultilingualField id={`${id}-name`} label={t`経由地の名前`} field="name" ja={place.nameJa} en={place.nameEn} translations={place.translations} onJa={(v) => p.onChange({ nameJa: v })} onEn={(v) => p.onChange({ nameEn: v })} onTranslations={(v) => p.onChange({ translations: v })} required invalid={p.invalidName} />
          <MultilingualField id={`${id}-desc`} label={t`説明`} field="description" ja={place.descriptionJa} en={place.descriptionEn} translations={place.translations} onJa={(v) => p.onChange({ descriptionJa: v })} onEn={(v) => p.onChange({ descriptionEn: v })} onTranslations={(v) => p.onChange({ translations: v })} multiline />
          <MultilingualField id={`${id}-history`} label={t`歴史・由来`} field="history" ja={place.historyJa} en={place.historyEn} translations={place.translations} onJa={(v) => p.onChange({ historyJa: v })} onEn={(v) => p.onChange({ historyEn: v })} onTranslations={(v) => p.onChange({ translations: v })} multiline />

          <Field label={t`種類`} htmlFor={`${id}-kind`}>
            <select
              id={`${id}-kind`}
              value={place.kind}
              // A new waypoint's switch follows the kind; a saved one keeps what was chosen for it.
              onChange={(e) => {
                const kind = e.target.value as PointKind;
                p.onChange(place.id === null ? { kind, stampable: stampableByDefault(kind) } : { kind });
              }}
              className={`${inputClass} max-w-xs`}
            >
              {pointKinds.map((k) => (
                <option key={k} value={k}>
                  {kindName[k]}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col gap-1">
            <Check id={`${id}-stampable`} checked={place.stampable} onChange={(v) => p.onChange({ stampable: v })}>
              {t`スタンプを押せる`}
            </Check>
            <p className="pl-9 text-base text-muted">
              {isStamp ? t`ここに着いた人が、スタンプを押せます。公開するには、現地の許可の確認が必要です。` : t`道案内のための点です。スタンプは押せません。`}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Check id={`${id}-stopby`} checked={place.stopBy} onChange={(v) => p.onChange({ stopBy: v })}>
              {t`寄り道（道すじから少しはずれた、任意の立ち寄り先）`}
            </Check>
            <p className="pl-9 text-base text-muted">{t`チェックを入れると、「経由地をつないで道をつくる」で、この点は通りません。代わりに、一つ前の経由地から、この場所までの寄り道の線（青い細い点線）を、地図で描けます。分かれ道に経由地を置き、その次にこの場所を並べてください。`}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Field label={t`写真のリンク`} htmlFor={`${id}-photo`} hint={t`https:// で始まるリンクを入れます。空にすると、写真は表示されません。`}>
              <TextInput id={`${id}-photo`} value={place.photoUrl} onChange={(v) => p.onChange({ photoUrl: v })} maxLength={500} invalid={p.invalidPhoto} />
            </Field>
            {p.invalidPhoto ? <p role="alert" className="text-base font-bold text-danger">{t`写真のリンクは、https:// で始まるものだけ使えます。`}</p> : null}
            <PhotoSlot url={place.photoUrl} className="max-w-md" />
          </div>

          <GalleryEditor photos={place.photos} onChange={(photos) => p.onChange({ photos })} name={place.nameJa} lat={place.lat} lng={place.lng} />

          <fieldset className="flex flex-col gap-3">
            <legend className="text-base font-bold">{t`位置`}</legend>
            <div className="flex flex-wrap gap-4">
              <Field label={t`緯度`} htmlFor={`${id}-lat`}>
                <NumberInput id={`${id}-lat`} value={place.lat} min={-90} max={90} onChange={(v) => p.onChange({ lat: v })} />
              </Field>
              <Field label={t`経度`} htmlFor={`${id}-lng`}>
                <NumberInput id={`${id}-lng`} value={place.lng} min={-180} max={180} onChange={(v) => p.onChange({ lng: v })} />
              </Field>
            </div>
            <p className="text-base text-muted">{t`位置は、公式の情報から入れて、地図で確かめます。推測では入れません。`}</p>
            <Check id={`${id}-verified`} checked={place.positionVerified} disabled={place.lat === null} onChange={(v) => p.onChange({ positionVerified: v })}>
              {t`位置を確認した`}
            </Check>
            <Field label={t`確認した情報源（サイト名やリンク）`} htmlFor={`${id}-source`}>
              <TextInput id={`${id}-source`} value={place.positionSource} onChange={(v) => p.onChange({ positionSource: v })} maxLength={500} />
            </Field>
          </fieldset>

          <details className="rounded-xl bg-surface p-4">
            <summary className="tap-target flex cursor-pointer items-center text-lg font-bold">{isStamp ? t`スタンプ・状態・許可の設定` : t`状態の設定`}</summary>
            <div className="mt-3 flex flex-col gap-5">
              {isStamp ? (
                <Field label={t`スタンプを押せる範囲（メートル）`} htmlFor={`${id}-radius`} hint={t`この経由地から、この距離の中にいるとスタンプを押せます。`}>
                  <div className="flex items-center gap-3">
                    <input id={`${id}-radius`} type="range" min={10} max={500} step={5} value={place.radiusM} onChange={(e) => p.onChange({ radiusM: Number(e.target.value) })} className="h-10 w-full max-w-sm accent-[var(--color-brand)]" />
                    <span className="w-20 text-lg font-bold tabular-nums">{place.radiusM} m</span>
                  </div>
                </Field>
              ) : null}

              <fieldset className="flex flex-col gap-3">
                <legend className="text-base font-bold">{t`いまの状態`}</legend>
                <select aria-label={t`いまの状態`} value={place.status} onChange={(e) => p.onChange({ status: e.target.value as SpotStatus })} className={`${inputClass} max-w-xs`}>
                  <option value="open">{statusName.open}</option>
                  <option value="caution">{statusName.caution}</option>
                  <option value="closed">{statusName.closed}</option>
                </select>
                <MultilingualField id={`${id}-note`} label={t`状態のひとこと`} field="statusNote" ja={place.statusNoteJa} en={place.statusNoteEn} translations={place.translations} onJa={(v) => p.onChange({ statusNoteJa: v })} onEn={(v) => p.onChange({ statusNoteEn: v })} onTranslations={(v) => p.onChange({ translations: v })} />
              </fieldset>

              {isStamp ? (
                <fieldset className="flex flex-col gap-3">
                  <legend className="text-base font-bold">{t`現地の許可`}</legend>
                  <Check id={`${id}-permission`} checked={place.permissionConfirmed} onChange={(v) => p.onChange({ permissionConfirmed: v })}>
                    {t`許可確認済み`}
                  </Check>
                  <Field label={t`許可してくれた人`} htmlFor={`${id}-permnote`}>
                    <TextInput id={`${id}-permnote`} value={place.permissionNote} onChange={(v) => p.onChange({ permissionNote: v })} maxLength={500} />
                  </Field>
                </fieldset>
              ) : null}
            </div>
          </details>

          <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
            {place.published ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-bold">{t`この経由地は公開されています。`}</p>
                <button type="button" disabled={p.busy} onClick={p.onUnpublish} className="tap-target rounded-xl border border-ink px-5 text-lg font-bold disabled:opacity-40">
                  {t`公開をやめる`}
                </button>
              </div>
            ) : (
              <>
                <button type="button" disabled={p.busy || blockers.length > 0} onClick={p.onPublish} className="tap-target w-fit rounded-xl bg-ink px-6 text-lg font-bold text-paper disabled:opacity-40">
                  {t`公開する`}
                </button>
                {blockers.length > 0 ? (
                  <ul className="list-disc pl-6 text-base text-muted">
                    {blockers.map((b) => (
                      <li key={b}>{blockerText[b]}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!p.canMoveUp} onClick={() => p.onMove(-1)} className="tap-target rounded-xl border-2 border-line px-4 text-base font-bold disabled:opacity-40">
              {t`順番を前へ`}
            </button>
            <button type="button" disabled={!p.canMoveDown} onClick={() => p.onMove(1)} className="tap-target rounded-xl border-2 border-line px-4 text-base font-bold disabled:opacity-40">
              {t`順番を後ろへ`}
            </button>
            <button type="button" disabled={place.published} onClick={p.onRemove} className="tap-target ml-auto rounded-xl border-2 border-danger px-4 text-base font-bold text-danger disabled:opacity-40">
              {t`この経由地を削除`}
            </button>
          </div>
          {place.published ? <p className="text-base text-muted">{t`公開中の経由地は、先に「公開をやめる」と、削除できます。`}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
