import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { SpotSheet } from "@/components/SpotSheet";
import { getSpot, pickText } from "@/lib/content";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const spot = await getSpot((await params).id);
  return { title: spot ? pickText(i18n.locale, spot.nameJa, spot.nameEn)?.text : undefined };
}

// Spot detail (WBS 3.2.5). A draft or unknown spot is a 404 (the API does the same).
export default async function SpotPage({ params }: Props) {
  const i18n = await initLingui();
  const spot = await getSpot((await params).id);
  if (!spot) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4">
        <BackLink href={localePath(i18n.locale, `/routes/${spot.routeId}`)}>
          <Trans>ルートにもどる</Trans>
        </BackLink>
      </div>
      <SpotSheet spot={spot} locale={i18n.locale} />
    </div>
  );
}
