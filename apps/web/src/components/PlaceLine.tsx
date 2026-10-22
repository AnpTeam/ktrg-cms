import type { Prefecture } from "@/lib/content";
import { PrefectureName } from "./PrefectureName";

/** Prefecture and municipality as one line: 「和歌山県 和歌山市」 in Japanese, "Wakayama City, Wakayama Prefecture" in English. */
export function PlaceLine({ prefecture, place, locale }: { prefecture: Prefecture | null; place: string | null; locale: string }) {
  if (!prefecture && !place) return null;
  const pref = prefecture ? <PrefectureName value={prefecture} /> : null;
  if (locale === "ja") {
    return (
      <>
        {pref}
        {pref && place ? " " : null}
        {place}
      </>
    );
  }
  return (
    <>
      {place}
      {pref && place ? ", " : null}
      {pref}
    </>
  );
}
