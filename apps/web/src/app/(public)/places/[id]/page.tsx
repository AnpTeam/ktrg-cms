import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import { Breadcrumb } from "@/components/Breadcrumb";
import { buttonStyle } from "@/components/button";
import { RouteCard, SpotCard } from "@/components/blog/LinkedCards";
import { HeroPhoto } from "@/components/map/HeroPhoto";
import { PlaceFacts } from "@/components/PlaceFacts";
import { RichText } from "@/components/RichText";
import { NameRuby } from "@/components/Ruby";
import { SectionBanner } from "@/components/SectionBanner";
import { GroupName } from "@/components/places/GroupName";
import { initLingui } from "@/i18n/server";
import { getSpot, listPlaces, listRoutes, pickText } from "@/lib/content";
import { formatDay } from "@/lib/format";
import { groupOf } from "@/lib/places";

type Props = { params: Promise<{ id: string }> };

const findPlace = async (id: string) => (await listPlaces()).find((p) => p.id === id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const place = await findPlace((await params).id);
  return { title: place ? (pickText(i18n.locale, place.nameJa, place.nameEn)?.text ?? place.nameJa) : undefined };
}

// One place of the directory. Only published places with a checked position reach the web app, so anything else is a 404.
export default async function PlacePage({ params }: Props) {
  const [i18n, { id }] = await Promise.all([initLingui(), params]);
  const [place, routes] = await Promise.all([findPlace(id), listRoutes()]);
  if (!place) notFound();
  const locale = i18n.locale;
  const name = pickText(locale, place.nameJa, place.nameEn);
  const description = pickText(locale, place.descriptionJa, place.descriptionEn);
  const course = routes.find((r) => place.routes.includes(r.order)) ?? null;
  const near = place.nearSpotId ? ((await getSpot(place.nearSpotId)) ?? null) : null;
  const group = groupOf(place.category);
  const mapHref = `/map?${course ? `route=${encodeURIComponent(course.id)}&` : ""}place=${encodeURIComponent(place.id)}`;

  return (
    <div className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-center gap-1 px-4">
        <Breadcrumb href="/places">
          <Trans>お店と施設</Trans>
        </Breadcrumb>
        <Breadcrumb href={`/places?group=${group}`}>
          <GroupName group={group} />
        </Breadcrumb>
      </div>

      <div className="flex flex-col gap-4 px-4">
        <h1 lang={name?.lang} className="font-serif text-3xl font-bold leading-snug has-[rt]:pt-3">
          <NameRuby title={name} reading={place.nameKana} />
        </h1>
        {place.photoUrl ? <HeroPhoto photo={{ src: place.photoUrl, alt: name?.text ?? place.nameJa, credit: place.photoCredit ?? null }} placeholder={false} /> : null}
        {description ? (
          <div lang={description.lang} className="whitespace-pre-line text-lg leading-8">
            <RichText text={description.text} lang={description.lang} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-4">
        <PlaceFacts
          place={{
            category: place.category,
            name: name?.text ?? place.nameJa,
            address: pickText(locale, place.addressJa ?? "", place.addressEn ?? null)?.text || null,
            phone: place.phone ?? null,
            hours: pickText(locale, place.hoursJa, place.hoursEn)?.text ?? null,
            closedDays: pickText(locale, place.closedDaysJa, place.closedDaysEn)?.text ?? null,
            website: place.website ?? null,
            status: place.status,
            checked: place.lastVerified ? formatDay(locale, place.lastVerified) : null,
          }}
        />
        <Link href={mapHref} className={buttonStyle("secondary", "lg", "flex")}>
          <Trans>地図で見る</Trans>
        </Link>
      </div>

      {course || near ? (
        <section className="flex flex-col gap-4 px-4">
          <SectionBanner>
            <Trans>近くの道</Trans>
          </SectionBanner>
          {near ? <SpotCard spot={near} locale={locale} /> : null}
          {course ? <RouteCard route={course} locale={locale} /> : null}
        </section>
      ) : null}
    </div>
  );
}
