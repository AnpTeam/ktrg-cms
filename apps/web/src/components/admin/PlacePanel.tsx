"use client";

import { useRef, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { pointKinds, stampableByDefault, type PointKind } from "@/lib/point-kinds";
import { publishBlockers, type PlaceDraft, type PublishBlocker } from "@/lib/admin/route-draft";
import type { SpotStatus } from "@/lib/admin/types";
import { RubyEditor } from "./RubyEditor";
import { Check, Field, inputClass, MultilingualField, NumberInput, TextInput } from "./fields";
import { GalleryEditor } from "./GalleryEditor";
import { PhotoLinkDetails } from "./PhotoLinkDetails";
import { PhotoSlot } from "./PhotoSlot";
import { PhotoUpload } from "./PhotoUpload";

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
  /** The route must be saved once before a waypoint can be saved on its own. */
  canSave: boolean;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  /** A map to place it on, under the numbers (the route editor has its own map tab). */
  positionMap?: ReactNode;
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
    ferry: t`港・フェリー乗り場`,
    campsite: t`キャンプ場`,
    other: t`その他`,
  };
}

/**
 * One place on the route. The short form (name, text, photo, position, kind) is what most edits need; the stamp
 * settings (range, status, permission) are folded away. What still stops it being published is always visible.
 */
/** A block of the place form, set off by a rule above it (and a heading, when it has none of its own). */
function Group({ title, first = false, children }: { title?: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-5 ${first ? "" : "border-t-2 border-line pt-6"}`}>
      {title ? <h4 className="text-xl font-bold">{title}</h4> : null}
      {children}
    </section>
  );
}

export function PlacePanel(p: PlacePanelProps) {
  const { t } = useLingui();
  const { place } = p;
  const blockers = publishBlockers(place, p.dirty);
  const kindName = useKindLabels();
  const isStamp = place.stampable;
  const blockerText: Record<PublishBlocker, string> = {
    unsaved: t`先に「この経由地を保存」してください。`,
    no_coordinates: t`位置を決めてください（地図に置くか、緯度と経度を入れます）。`,
    position_not_verified: t`位置を公式の情報で確認し、「位置を確認した」にチェックを入れて情報源を書いてください。`,
    permission_required: t`現地の許可を確認し、「許可確認済み」にチェックを入れてください。`,
  };
  const statusName: Record<SpotStatus, string> = { open: t`通常`, caution: t`注意`, closed: t`通行止め`, info: t`案内のみ` };
  const id = `place-${place.key}`;
  const settings = useRef<HTMLDetailsElement>(null);
  // What to tick for each reason the place cannot be published yet: the button under 公開する takes the admin there.
  const blockerField: Partial<Record<PublishBlocker, string>> = { no_coordinates: `${id}-lat`, position_not_verified: `${id}-verified`, permission_required: `${id}-permission` };
  const goTo = (fieldId: string) => {
    if (fieldId === `${id}-permission` && settings.current) settings.current.open = true;
    const el = document.getElementById(fieldId);
    el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  };

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
        <div className="flex flex-col gap-6 border-t border-line p-4">
          <Group title={t`文章`} first>
          <MultilingualField id={`${id}-name`} label={t`経由地の名前`} field="name" ja={place.nameJa} en={place.nameEn} translations={place.translations} onJa={(v) => p.onChange({ nameJa: v })} onEn={(v) => p.onChange({ nameEn: v })} onTranslations={(v) => p.onChange({ translations: v })} required invalid={p.invalidName} />
          <Field label={t`名前の読み`} hint={t`漢字の上に出るふりがなです。寺社や経塚の名前は、辞書には任せず人が入れます。`}>
            <RubyEditor name={place.nameJa} value={place.nameKana} onChange={(v) => p.onChange({ nameKana: v })} />
          </Field>
          <MultilingualField id={`${id}-desc`} label={t`説明`} field="description" ja={place.descriptionJa} en={place.descriptionEn} translations={place.translations} onJa={(v) => p.onChange({ descriptionJa: v })} onEn={(v) => p.onChange({ descriptionEn: v })} onTranslations={(v) => p.onChange({ translations: v })} long="short" />
          <MultilingualField id={`${id}-history`} label={t`歴史・由来`} field="history" ja={place.historyJa} en={place.historyEn} translations={place.translations} onJa={(v) => p.onChange({ historyJa: v })} onEn={(v) => p.onChange({ historyEn: v })} onTranslations={(v) => p.onChange({ translations: v })} long="short" />
          <MultilingualField id={`${id}-source`} label={t`出典`} field="source" ja={place.sourceJa} en={place.sourceEn} translations={place.translations} onJa={(v) => p.onChange({ sourceJa: v })} onEn={(v) => p.onChange({ sourceEn: v })} onTranslations={(v) => p.onChange({ translations: v })} long="short" />

          </Group>

          <Group title={t`種類とスタンプ`}>
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
              {isStamp ? t`ここに着いた人が、スタンプを押せます。公開するには、現地の許可の確認が必要です。` : t`スタンプは押せません。場所のページは見られます。公開するには、現地の許可の確認が必要です。`}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Check id={`${id}-stopby`} checked={place.stopBy} onChange={(v) => p.onChange({ stopBy: v })}>
              {t`寄り道（道すじから少しはずれた、任意の立ち寄り先）`}
            </Check>
            <p className="pl-9 text-base text-muted">{t`チェックを入れると、「経由地をつないで道をつくる」で、この点は通りません。代わりに、一つ前の経由地から、この場所までの寄り道の線（青い細い点線）を、地図で描けます。分かれ道に経由地を置き、その次にこの場所を並べてください。`}</p>
          </div>

          </Group>

          <Group title={t`写真`}>
            <PhotoUpload onUploaded={(url) => p.onChange({ photoUrl: url })} />
            <PhotoLinkDetails open={p.invalidPhoto}>
              <Field label={t`写真のリンク`} htmlFor={`${id}-photo`} hint={t`https:// で始まるリンクを入れます。空にすると、写真は表示されません。`}>
                <TextInput id={`${id}-photo`} value={place.photoUrl} onChange={(v) => p.onChange({ photoUrl: v })} maxLength={500} invalid={p.invalidPhoto} />
              </Field>
            </PhotoLinkDetails>
            <Field label={t`写真の出どころ`} htmlFor={`${id}-photo-credit`} hint={t`写真の下に ℹ︎ と一緒に表示されます。リンクは [表示する文字](https://…) と書きます。`}>
              <TextInput id={`${id}-photo-credit`} value={place.photoCredit} onChange={(v) => p.onChange({ photoCredit: v })} maxLength={500} />
            </Field>
            {p.invalidPhoto ?<p role="alert" className="text-base font-bold text-danger">{t`写真のリンクは、https:// で始まるものだけ使えます。`}</p> : null}
            <PhotoSlot url={place.photoUrl} className="max-w-md" />
          </Group>

          <Group>
            <p className="text-base font-bold">{t`この場所のスタンプの絵`}</p>
            <p className="text-base text-muted">{t`入れると、この場所のスタンプが、ふつうの赤い印の代わりにこの絵になります。正方形で、背景が透明な画像がきれいです。`}</p>
            <PhotoUpload onUploaded={(url) => p.onChange({ stampImageUrl: url })} />
            <PhotoSlot url={place.stampImageUrl} className="max-w-32" />
            {place.stampImageUrl ? (
              <button type="button" className="self-start text-base font-bold text-accent underline" onClick={() => p.onChange({ stampImageUrl: "" })}>
                {t`絵をはずす`}
              </button>
            ) : null}
          </Group>

          <Group>
            <GalleryEditor photos={place.photos} onChange={(photos) => p.onChange({ photos })} name={place.nameJa} lat={place.lat} lng={place.lng} />
          </Group>

          <fieldset className="flex flex-col gap-3 border-t-2 border-line pt-6">
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
            {p.positionMap}
            <Check id={`${id}-verified`} checked={place.positionVerified} disabled={place.lat === null} onChange={(v) => p.onChange({ positionVerified: v })}>
              {t`位置を確認した`}
            </Check>
            <Field label={t`確認した情報源（サイト名やリンク）`} htmlFor={`${id}-source`}>
              <TextInput id={`${id}-source`} value={place.positionSource} onChange={(v) => p.onChange({ positionSource: v })} maxLength={500} />
            </Field>
          </fieldset>

          {/* Open at first, so the permission tick is in view; it can be folded away. */}
          <details ref={settings} open className="rounded-xl bg-surface p-4">
            <summary className="tap-target flex cursor-pointer flex-wrap items-center gap-x-3 text-lg font-bold">
              {isStamp ? t`スタンプ・状態・許可の設定` : t`状態・許可の設定`}
              {place.permissionConfirmed ? null : <span className="rounded-full border-2 border-danger px-2 text-base text-danger">{t`許可が未確認`}</span>}
            </summary>
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
                  <option value="info">{statusName.info}</option>
                </select>
                <MultilingualField id={`${id}-note`} label={t`状態のひとこと`} field="statusNote" ja={place.statusNoteJa} en={place.statusNoteEn} translations={place.translations} onJa={(v) => p.onChange({ statusNoteJa: v })} onEn={(v) => p.onChange({ statusNoteEn: v })} onTranslations={(v) => p.onChange({ translations: v })} />
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="text-base font-bold">{t`現地の許可`}</legend>
                <Check id={`${id}-permission`} checked={place.permissionConfirmed} onChange={(v) => p.onChange({ permissionConfirmed: v })}>
                  {t`許可確認済み`}
                </Check>
                <Field label={t`許可してくれた人`} htmlFor={`${id}-permnote`}>
                  <TextInput id={`${id}-permnote`} value={place.permissionNote} onChange={(v) => p.onChange({ permissionNote: v })} maxLength={500} />
                </Field>
              </fieldset>
            </div>
          </details>

          <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={p.busy || !p.dirty || !p.canSave} onClick={p.onSave} className="tap-target w-fit rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-40">
                {t`この経由地を保存`}
              </button>
              {!p.canSave ? <p className="text-base text-muted">{t`先にルートを保存してください。`}</p> : place.published && p.dirty ? <p className="text-base text-muted">{t`保存すると、この経由地は下書きに戻ります。`}</p> : null}
            </div>
            {place.published ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg font-bold">{t`この経由地は公開されています。`}</p>
                <button type="button" disabled={p.busy} onClick={p.onUnpublish} className="tap-target rounded-full border border-ink px-5 text-lg font-bold disabled:opacity-40">
                  {t`公開をやめる`}
                </button>
              </div>
            ) : (
              <>
                <button type="button" disabled={p.busy || blockers.length > 0} onClick={p.onPublish} className="tap-target w-fit rounded-full bg-ink px-6 text-lg font-bold text-paper disabled:opacity-40">
                  {t`公開する`}
                </button>
                {blockers.length > 0 ? (
                  <ul className="list-disc pl-6 text-base text-muted">
                    {blockers.map((b) => {
                      const target = blockerField[b];
                      return (
                        <li key={b}>
                          {target ? (
                            <button type="button" onClick={() => goTo(target)} className="tap-target text-left font-bold text-accent underline underline-offset-4">
                              {blockerText[b]}
                            </button>
                          ) : (
                            blockerText[b]
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {p.canMoveUp || p.canMoveDown ? (
              <>
                <button type="button" disabled={!p.canMoveUp} onClick={() => p.onMove(-1)} className="tap-target rounded-full border-2 border-line px-4 text-base font-bold disabled:opacity-40">
                  {t`順番を前へ`}
                </button>
                <button type="button" disabled={!p.canMoveDown} onClick={() => p.onMove(1)} className="tap-target rounded-full border-2 border-line px-4 text-base font-bold disabled:opacity-40">
                  {t`順番を後ろへ`}
                </button>
              </>
            ) : null}
            <button type="button" disabled={place.published} onClick={p.onRemove} className="tap-target ml-auto rounded-full border-2 border-danger px-4 text-base font-bold text-danger disabled:opacity-40">
              {t`この経由地を削除`}
            </button>
          </div>
          {place.published ? <p className="text-base text-muted">{t`公開中の経由地は、先に「公開をやめる」と、削除できます。`}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
