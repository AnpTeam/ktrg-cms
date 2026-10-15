import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { MapSettingsForm } from "@/components/map/MapSettingsForm";
import type { MapStop } from "@/components/map/TrailMap";
import { getRoute, pickText } from "@/lib/content";
import { mapSettingsCookie, parseMapSettings } from "@/lib/map-settings";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

// Developer tool: change how every map looks and preview it on route 2. It exists only while
// developing (404 in production); when the admin area exists (WBS 3.4) this moves behind the admin role.
export default async function MapSettingsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const i18n = await initLingui();
  const route = await getRoute("sample-r2");
  const settings = parseMapSettings((await cookies()).get(mapSettingsCookie)?.value);

  const stops: MapStop[] = (route?.spots ?? []).flatMap((spot, index) => {
    const name = pickText(i18n.locale, spot.nameJa, spot.nameEn);
    if (!spot.position || !name) return [];
    return [
      {
        id: spot.id,
        order: index + 1,
        name: name.text,
        label: `${index + 1}. ${name.text}`,
        nameLang: name.lang,
        position: { lat: spot.position.lat, lng: spot.position.lng },
        stamped: null,
        status: spot.status,
        href: localePath(i18n.locale, `/spots/${spot.id}`),
      },
    ];
  });

  return (
    <div className="flex flex-col gap-4 px-4 pt-2">
      <h1 className="text-3xl font-bold">
        <Trans>地図の見た目</Trans>
      </h1>
      <p className="text-lg">{i18n._(msg`開発用の設定です。公開版では表示されません。`)}</p>
      <MapSettingsForm initial={settings} stops={stops} line={route?.line ?? null} />
    </div>
  );
}
