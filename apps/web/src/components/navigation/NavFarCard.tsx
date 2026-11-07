"use client";

import { useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { AccessIcon, useAccessTypeNames } from "@/components/AccessList";
import { Localized } from "@/components/Localized";
import { pickText } from "@/lib/pick-text";
import { courseEnds, nearerEnd, sortAccess, transitLink } from "@/lib/navigation/transit-links";
import { useNavigation } from "./NavigationProvider";
import { buttonStyle } from "@/components/button";
import { CloseIcon } from "@/components/icons";

const linkClass = buttonStyle("secondary", "sm", "inline-flex");

/**
 * Shown instead of the distance and direction when the visitor is far from the course (docs/navigation-transit-plan.md):
 * the course's hand-entered ways of getting there, with links to other services for the real timetables, and the walking
 * route as a choice. Nothing is routed here, and only a station's checked position is put in a link.
 */
export function NavFarCard() {
  const { t, i18n } = useLingui();
  const { session, chooseWalk, signedIn } = useNavigation();
  const names = useAccessTypeNames();
  const dialog = useRef<HTMLDialogElement>(null);
  const [asked, setAsked] = useState(false); // shortcut: stays "asking" until the path arrives or the card goes away; add a retry if that is not enough
  if (!session) return null;
  const { model, snapshot, access } = session;
  const points = sortAccess(access, nearerEnd(courseEnds(model), snapshot.position ?? { lat: 0, lng: 0 }));
  const external = t`（外部サイトが新しいタブで開きます）`;

  // The banner stays small so the map is still seen; the ways to get there open in a dialog.
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-bold leading-snug">{t`この区間は遠くにあります。電車やバスで向かいましょう。`}</p>
      <button type="button" onClick={() => dialog.current?.showModal()} className={buttonStyle("primary", "md", "flex w-full")}>
        {t`行き方を見る`}
      </button>
      <dialog ref={dialog} aria-labelledby="nav-far-title" className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-lg bg-paper p-5 text-ink backdrop:bg-black/60">
        <div className="flex items-center justify-between gap-2">
          <h2 id="nav-far-title" className="text-2xl font-bold">
            {t`行き方`}
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label={t`とじる`} className="tap-target -mr-2 inline-flex shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface">
            <CloseIcon />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-4">
          {points.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-lg font-bold">{t`電車・バスで行く`}</h3>
              <ul className="flex flex-col gap-2">
                {points.map((p, i) => {
                  const name = pickText(i18n.locale, p.nameJa, p.nameEn);
                  const note = pickText(i18n.locale, p.noteJa, p.noteEn);
                  const links = [
                    { label: t`Googleマップ`, href: transitLink(p, "google") },
                    { label: t`Yahoo!マップ`, href: transitLink(p, "yahoo") },
                    { label: t`時刻表`, href: p.url && /^https:\/\//.test(p.url) ? p.url : null },
                  ].filter((l): l is { label: string; href: string } => l.href !== null);
                  return (
                    <li key={i} className="flex flex-col gap-2 rounded-lg bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <AccessIcon type={p.type} size={44} />
                        <div className="min-w-0">
                          <p className="text-base leading-tight text-muted">{names[p.type]}</p>
                          <p className="text-lg font-bold leading-snug">
                            <Localized value={name} />
                          </p>
                        </div>
                      </div>
                      {note ? (
                        <p className="text-base leading-snug">
                          <Localized value={note} tag={false} />
                        </p>
                      ) : null}
                      {links.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {links.map((l) => (
                            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                              {l.label}
                              <span aria-hidden="true"> ↗</span>
                              <span className="sr-only"> {external}</span>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="text-base leading-snug text-muted">{t`リンクは別のサービスを開きます。渡すのは駅の場所だけで、あなたの位置は渡しません。`}</p>
            </section>
          ) : (
            <p className="text-base leading-snug text-muted">{t`この区間の行き方は、まだ登録されていません。`}</p>
          )}
          {signedIn ? (
            <button
              type="button"
              disabled={asked}
              onClick={() => {
                setAsked(true);
                chooseWalk();
              }}
              className={buttonStyle("secondary", "md", "flex w-full")}
            >
              {asked ? t`歩く道を調べています…` : t`歩いて行く道を見る`}
            </button>
          ) : (
            <p className="text-base leading-snug text-muted">{t`歩く道を調べるには、ログインしてください。`}</p>
          )}
          <button type="button" onClick={() => dialog.current?.close()} className={buttonStyle("secondary", "md", "flex w-full")}>
            {t`とじる`}
          </button>
        </div>
      </dialog>
    </div>
  );
}
