"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { rememberLocale } from "@/i18n/cookie";
import { locales, type Locale } from "@/i18n/locales";
import { TOTAL_ROUTES, TOTAL_STAMPS, TRAIL_KM } from "@/lib/rally";
import { isInAppBrowser } from "@/lib/browser-check";
import { track } from "@/lib/track";

const INTRO_COOKIE = "intro";
// Endonyms: each language names itself, so it is findable in a language the person cannot read.
const names: Record<Locale, string> = { ja: "日本語", en: "English" };

const big = "tap-target flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-xl font-bold";

// Already opened from the home screen: nothing to add.
const standaloneQuery = "(display-mode: standalone)";
const subscribeStandalone = (onChange: () => void) => {
  const q = window.matchMedia(standaloneQuery);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
const isStandalone = () => window.matchMedia(standaloneQuery).matches || (navigator as { standalone?: boolean }).standalone === true;

type InstallPrompt = Event & { prompt: () => Promise<unknown> };

/**
 * How to put the app on the home screen (see MDN, "Making PWAs installable"). Where the browser offers an install prompt
 * (Chrome and Edge, Android and desktop) a button asks for it; on an iPhone or iPad the way is Safari's share menu, which no
 * page can open, so the steps are written out; a browser inside another app (LINE ...) cannot add it at all. Only drawn
 * after the person has stepped to it, so it never runs on the server.
 */
function InstallStep() {
  const [offer, setOffer] = useState<InstallPrompt | null>(null);
  const [ua] = useState(() => navigator.userAgent);
  const ios = /\b(iPhone|iPad|iPod)\b/.test(ua) || (/\bMacintosh\b/.test(ua) && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const onOffer = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini bar away: the button below asks instead
      setOffer(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onOffer);
    return () => window.removeEventListener("beforeinstallprompt", onOffer);
  }, []);
  return (
    <>
      <h1 id="intro-title" className="text-3xl font-bold text-accent">
        <Trans>ホーム画面に追加しましょう</Trans>
      </h1>
      <p className="text-lg leading-8">
        <Trans>ホーム画面に追加すると、アプリのようにすぐ開けます。山の中でも、探す手間がかかりません。</Trans>
      </p>
      {isInAppBrowser(ua) ? (
        <p className="rounded-3xl bg-surface p-4 text-lg leading-8">
          <Trans>いま開いているのは、ほかのアプリの中のブラウザです。Safari や Chrome で開きなおしてから、追加してください。</Trans>
        </p>
      ) : offer ? (
        <button type="button" onClick={() => void offer.prompt()} className={`${big} bg-ink text-paper`}>
          <Trans>ホーム画面に追加する</Trans>
        </button>
      ) : ios ? (
        <ol className="flex list-decimal flex-col gap-3 rounded-3xl bg-surface p-4 pl-9 text-lg leading-8">
          <li><Trans>Safari で、画面の下（または上）にある共有ボタン（□に↑）を押します。</Trans></li>
          <li><Trans>メニューを下へ動かして、「ホーム画面に追加」を押します。</Trans></li>
          <li><Trans>右上の「追加」を押すと、できあがりです。</Trans></li>
        </ol>
      ) : (
        <p className="rounded-3xl bg-surface p-4 text-lg leading-8">
          <Trans>ブラウザのメニュー（⋮ や ⋯）から、「ホーム画面に追加」または「アプリをインストール」をえらびます。</Trans>
        </p>
      )}
    </>
  );
}

/**
 * What a new visitor meets on the home page, once: pick a language, what 葛城修験 is, how the app works in a few
 * cards, then one big start button that goes to the routes. Full screen on a phone and a card in the middle of the page on a larger screen, over the page, so the page underneath is still the
 * real home page for search engines and for anyone who skips it. Shown only to someone signed out who has not seen
 * it (the `intro` cookie, which the server reads); skipping counts as seeing it.
 */
export function IntroFlow({ seen, guide }: { seen: boolean; guide: { title: string; intro: string; steps: { title: string; text: string }[] } | null }) {
  const { i18n } = useLingui();
  const router = useRouter();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  // The how-to-play words come from the server (the page text an editor wrote, else the built-in one); null only once the intro is seen.
  const help = { guideTitle: guide?.title ?? "", guideIntro: guide?.intro ?? "", steps: guide?.steps ?? [] };
  const installed = useSyncExternalStore(subscribeStandalone, isStandalone, () => true);
  // The steps, in order; the home-screen step is left out once the app is opened from the home screen.
  const steps = ["language", "about", "features", "play", ...(installed ? [] : ["install"]), "start"] as const;
  const STEPS = steps.length;
  const current = steps[step];

  const open = !seen && !dismissed && pathname === "/";

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      track("intro_shown");
    }
    if (!open && el.open) el.close();
  }, [open]);

  // The page behind must not scroll when the wheel is over the dim area or the dialog is at its end.
  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  function finish(how: "done" | "skipped") {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${INTRO_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    track(`intro_${how}`, { step });
    setDismissed(true);
    if (how === "done") router.push("/routes");
    else router.refresh(); // the server learns it was seen
  }

  const next = () => {
    track("intro_step", { step: step + 1 });
    setStep((s) => Math.min(s + 1, STEPS - 1));
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="intro-title"
      onClose={() => setDismissed(true)}
      onCancel={(e) => {
        e.preventDefault();
        finish("skipped");
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-paper p-0 text-ink backdrop:bg-black/60 md:m-auto md:h-auto md:max-h-[88dvh] md:w-[38rem] md:max-w-[calc(100%-2rem)] md:rounded-3xl md:shadow-2xl"
    >
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 pb-8 pt-[calc(1.5rem+env(safe-area-inset-top))] md:min-h-[30rem] md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-3">
          <ol aria-label={`${step + 1} / ${STEPS}`} className="flex gap-2">
            {Array.from({ length: STEPS }, (_, i) => (
              <li key={i} aria-hidden="true" className={`h-2.5 w-8 rounded-full ${i <= step ? "bg-brand" : "bg-line/40"}`} />
            ))}
          </ol>
          <button type="button" onClick={() => finish("skipped")} className="tap-target text-lg font-bold text-muted underline">
            <Trans>スキップ</Trans>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5">
          {current === "language" ? (
            <>
              <h1 id="intro-title" className="font-serif text-4xl font-bold leading-snug">
                葛城修験 <span className="block text-2xl">Katsuragi Shugen</span>
              </h1>
              <p className="text-xl font-bold">言語 / Language</p>
              <div className="flex flex-col gap-3">
                {locales.map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    lang={locale}
                    aria-pressed={locale === i18n.locale}
                    autoFocus={locale === i18n.locale}
                    onClick={() => {
                      if (locale !== i18n.locale) {
                        rememberLocale(locale);
                        router.refresh();
                      }
                      next();
                    }}
                    className={`${big} border-2 ${locale === i18n.locale ? "border-ink bg-ink text-paper" : "border-ink bg-paper text-ink"}`}
                  >
                    {names[locale]}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {current === "about" ? (
            <>
              <h1 id="intro-title" className="text-3xl font-bold text-accent">
                <Trans>葛城修験とは</Trans>
              </h1>
              <p className="max-w-prose text-lg leading-8">
                <Trans>
                  和泉山脈から金剛山地へ。大阪・和歌山・奈良の境にのびるこの山なみは、古くから「葛城」と呼ばれ、神の宿る山として敬われてきました。山で心身をきたえる修験道を開いたと伝わる役行者が、はじめて修行をしたのも、この山々だといわれています。
                </Trans>
              </p>
              <p className="max-w-prose text-lg leading-8">
                <Trans>この道すじには、法華経の二十八の章にちなむ「経塚」が並び、「葛城二十八宿」と呼ばれています。</Trans>
              </p>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-surface p-3">
                  <dt className="text-base text-muted"><Trans>コース</Trans></dt>
                  <dd className="text-xl font-bold"><Trans>全{TOTAL_ROUTES}区間</Trans></dd>
                </div>
                <div className="rounded-2xl bg-surface p-3">
                  <dt className="text-base text-muted"><Trans>長さ</Trans></dt>
                  <dd className="text-xl font-bold"><Trans>約{TRAIL_KM}km</Trans></dd>
                </div>
                <div className="rounded-2xl bg-surface p-3">
                  <dt className="text-base text-muted"><Trans>経塚</Trans></dt>
                  <dd className="text-xl font-bold"><Trans>{TOTAL_STAMPS}か所</Trans></dd>
                </div>
              </dl>
            </>
          ) : null}

          {current === "features" ? (
            <>
              <h1 id="intro-title" className="text-3xl font-bold text-accent">
                <Trans>このアプリでわかること</Trans>
              </h1>
              <ul className="flex flex-col gap-3">
                {[
                  { title: <Trans>地図とルート</Trans>, text: <Trans>全{TOTAL_ROUTES}区間の道すじを、地図で見られます。距離、時間、きつさ、行き方もわかります。</Trans> },
                  { title: <Trans>場所の物語</Trans>, text: <Trans>経由地ごとに、写真と、名前の由来や歴史を読めます。近くの駅、バス停、駐車場もわかります。</Trans> },
                  { title: <Trans>最新のお知らせ</Trans>, text: <Trans>通行止めなどの知らせを、確認した日づけで見られます。</Trans> },
                  { title: <Trans>スタンプラリー</Trans>, text: <Trans>歩いた場所で、スタンプを集められます。登録しなくても始められます。</Trans> },
                ].map((f, i) => (
                  <li key={i} className="rounded-3xl bg-surface p-4">
                    <h2 className="text-xl font-bold leading-snug text-accent">{f.title}</h2>
                    <p className="mt-1 text-lg leading-7">{f.text}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {current === "play" ? (
            <>
              <h1 id="intro-title" className="text-3xl font-bold text-accent">{help.guideTitle}</h1>
              <p className="text-lg leading-8">{help.guideIntro}</p>
              <ol className="flex flex-col gap-3">
                {/* The last step of the guide is "sign up": that waits until the visitor opens the rallies page. */}
                {help.steps.slice(0, -1).map((s, i) => (
                  <li key={s.title} className="flex gap-4 rounded-3xl bg-surface p-4">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-on-brand">{i + 1}</span>
                    <div>
                      <h2 className="text-xl font-bold leading-snug text-accent">{s.title}</h2>
                      <p className="mt-1 text-lg leading-7">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {current === "install" ? <InstallStep /> : null}

          {current === "start" ? (
            <>
              <h1 id="intro-title" className="text-3xl font-bold text-accent">
                <Trans>さあ、歩きはじめましょう</Trans>
              </h1>
              <p className="text-lg leading-8">
                <Trans>まずは、歩きたい道をえらびます。登録しなくても、スタンプは押せます。</Trans>
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {step === STEPS - 1 ? (
            <button type="button" onClick={() => finish("done")} className={`${big} bg-brand text-on-brand`}>
              <Trans>はじめる</Trans>
            </button>
          ) : step > 0 ? (
            <button type="button" onClick={next} className={`${big} bg-ink text-paper`}>
              <Trans>つぎへ</Trans>
            </button>
          ) : null}
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className={`${big} border border-ink text-ink`}>
              <Trans>もどる</Trans>
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
