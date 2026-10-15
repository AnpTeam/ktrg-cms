import { Trans } from "@lingui/react/macro";
import { pickText, type SpotStatus } from "@/lib/content";
import { formatUpdated } from "@/lib/format";
import { StatusWord } from "./StatusWord";
import { Localized } from "./Localized";

/**
 * The status block on a spot. Open is a calm line. Caution has a thick amber
 * border. Closed has a striped barrier bar and says plainly that stamps cannot
 * be collected. Neither uses red: vermilion is reserved for the stamp seal.
 */
export function StatusBanner({
  status,
  noteJa,
  noteEn,
  updatedAt,
  locale,
}: {
  status: SpotStatus;
  noteJa: string | null;
  noteEn: string | null;
  updatedAt: string | null;
  locale: string;
}) {
  const note = pickText(locale, noteJa, noteEn);
  const updated = updatedAt ? formatUpdated(locale, updatedAt) : null;

  const details = (
    <>
      {note ? (
        <p className="mt-2 text-lg">
          <Localized value={note} />
        </p>
      ) : null}
      {updated ? (
        <p className="mt-2 text-base text-muted">
          <Trans>更新 {updated}（日本時間）</Trans>
        </p>
      ) : null}
    </>
  );

  if (status === "open") {
    return (
      <section className="px-4">
        <p className="text-xl">
          <StatusWord status="open" />
        </p>
        {details}
      </section>
    );
  }

  if (status === "caution") {
    return (
      <section className="mx-4 rounded-xl border-4 border-caution p-4">
        <p className="text-2xl">
          <StatusWord status="caution" />
        </p>
        {details}
      </section>
    );
  }

  return (
    <section className="mx-4 overflow-hidden rounded-xl border-4 border-ink">
      {/* Barrier stripes: closed reads as "blocked" even at a glance, without red. */}
      <div
        aria-hidden="true"
        className="h-3 bg-[repeating-linear-gradient(135deg,var(--color-ink)_0_12px,var(--color-surface)_12px_24px)]"
      />
      <div className="p-4">
        <p className="text-2xl">
          <StatusWord status="closed" />
        </p>
        <p className="mt-2 text-lg font-bold">
          <Trans>いまは、ここでスタンプを押せません。</Trans>
        </p>
        {details}
      </div>
    </section>
  );
}
