"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useErrorMessages } from "@/components/useErrorMessages";
import { api } from "@/lib/api";
import { outcome } from "@/lib/admin/admin-client";
import type { AdminSharedSpot } from "@/lib/admin/types";
import { listRequest, type ListAnswer, type ListPage } from "@/lib/admin/lists/list-client";
import type { ErrorKey } from "@/lib/api-error";

const chip = "tap-target inline-flex items-center justify-center rounded-full border border-line bg-paper px-4 text-base font-bold hover:bg-surface disabled:opacity-40";

type Found = { id: string; name: string; routeId: string };

/**
 * Places of other courses that this course also holds: the end of one course is the start of the next, and it is one
 * place (one stamp, one set of words). Added and removed here are saved at once, like the nearby places, not with the
 * route form. Editing the place itself is done on its home course.
 */
export function SharedPlaces({ routeId, initial, lent, routeNames, locale }: { routeId: string; initial: AdminSharedSpot[]; lent: { key: string; name: string; routeIds: string[] }[]; routeNames: Record<string, string>; locale: string }) {
  const { t } = useLingui();
  const messages = useErrorMessages();
  const [shared, setShared] = useState(initial);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const nameOf = (s: { nameJa: string; nameEn: string | null }) => (locale === "en" && s.nameEn ? s.nameEn : s.nameJa);

  useEffect(() => {
    if (!adding) return;
    let live = true;
    const timer = setTimeout(async () => {
      const words = query.trim();
      if (!words) return setFound(null);
      const res: ListAnswer<ListPage> = await listRequest<ListPage>("GET", `places?${new URLSearchParams({ q: words })}`);
      if (!live) return;
      if (!res.ok) return setError(res.key);
      setFound(
        res.data.items.map((it) => {
          const ja = String(it.nameJa ?? "");
          const en = typeof it.nameEn === "string" ? it.nameEn : "";
          return { id: it.id, name: locale === "en" && en ? en : ja, routeId: String(it.routeId ?? "") };
        }),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [adding, query, locale]);

  async function add(spot: Found) {
    setBusy(spot.id);
    setError(null);
    // First on this course by default; the number beside it moves it.
    const res = await outcome(api.admin.routes({ id: routeId })["shared-spots"]({ spotId: spot.id }).put({ position: 0 }));
    if (!res.ok) {
      setBusy(null);
      return setError(res.key);
    }
    const one = await outcome(api.admin.routes({ id: routeId }).get());
    setBusy(null);
    if (one.ok) setShared(one.data.shared as unknown as AdminSharedSpot[]);
    setQuery("");
    setFound(null);
  }

  async function move(spotId: string, position: number) {
    setBusy(spotId);
    setError(null);
    const res = await outcome(api.admin.routes({ id: routeId })["shared-spots"]({ spotId }).put({ position }));
    setBusy(null);
    if (!res.ok) return setError(res.key);
    setShared((list) => list.map((s) => (s.id === spotId ? { ...s, position } : s)));
  }

  async function remove(spotId: string) {
    setBusy(spotId);
    setError(null);
    const res = await outcome(api.admin.routes({ id: routeId })["shared-spots"]({ spotId }).delete());
    setBusy(null);
    if (!res.ok) return setError(res.key);
    setShared((list) => list.filter((s) => s.id !== spotId));
  }

  const taken = new Set(shared.map((s) => s.id));
  const results = (found ?? []).filter((f) => f.routeId !== routeId && !taken.has(f.id));

  return (
    <section aria-label={t`ほかのコースと共有する経由地`} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4">
      <h3 className="text-lg font-bold">{t`ほかのコースと共有する経由地`}</h3>
      <p className="text-base text-muted">{t`コースの終わりが次のコースの始まりのときは、同じ場所を二つのコースに置けます。スタンプは1つで、両方のコースに数えられます。内容を直すときは、もとのコースで直します。`}</p>
      {lent.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-xl bg-surface p-3 text-base">
          <p className="font-bold">{t`このコースの経由地で、ほかのコースにも置いているもの`}</p>
          <ul className="list-disc pl-6">
            {lent.map((l) => (
              <li key={l.key}>
                {l.name}
                {" — "}
                {l.routeIds.map((id, i) => (
                  <span key={id}>
                    {i > 0 ? "、" : ""}
                    <Link href={`/admin/routes/${id}`} className="text-accent underline underline-offset-4">
                      {routeNames[id] ?? t`もとのコース`}
                    </Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {shared.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {shared.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
              <span className="min-w-0 flex-1 text-lg">
                <span className="font-bold">{nameOf(s)}</span>{" "}
                <Link href={`/admin/routes/${s.routeId}`} className="text-base text-accent underline underline-offset-4">
                  {routeNames[s.routeId] ?? t`もとのコース`}
                </Link>
              </span>
              <label className="flex items-center gap-2 text-base">
                {t`この数の経由地のあとに置く（0 = 最初）`}
                <input
                  type="number"
                  min={0}
                  max={1000}
                  defaultValue={s.position}
                  key={s.position}
                  disabled={busy !== null}
                  onBlur={(e) => {
                    const n = Math.max(0, Math.min(1000, Math.trunc(Number(e.target.value))));
                    if (Number.isFinite(n) && n !== s.position) void move(s.id, n);
                  }}
                  className="h-11 w-20 rounded-full border border-line bg-paper px-2 text-lg"
                />
              </label>
              <button type="button" disabled={busy !== null} onClick={() => void remove(s.id)} className={`${chip} border-danger text-danger`}>
                {t`はずす`}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-base font-bold text-danger">
          {messages[error]}
        </p>
      ) : null}
      {adding ? (
        <div className="flex flex-col gap-2">
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t`名前で探す`} aria-label={t`名前で探す`} className="h-12 rounded-full border border-line bg-paper px-3 text-lg" />
          {found !== null && results.length === 0 ? <p className="text-base text-muted">{t`見つかりませんでした。`}</p> : null}
          <ul className="flex flex-col gap-2">
            {results.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
                <span className="min-w-0 flex-1 text-lg">
                  <span className="font-bold">{f.name}</span> <span className="text-base text-muted">{routeNames[f.routeId] ?? ""}</span>
                </span>
                <button type="button" disabled={busy !== null} onClick={() => void add(f)} className={chip}>
                  {t`このコースに置く`}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setQuery("");
              setFound(null);
            }}
            className={`${chip} self-start`}
          >
            {t`閉じる`}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${chip} self-start`}>
          {t`ほかのコースの経由地を加える`}
        </button>
      )}
    </section>
  );
}
