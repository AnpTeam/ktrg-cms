import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import { BackLink } from "@/components/BackLink";
import { Localized } from "@/components/Localized";
import { CreditCaption } from "@/components/PhotoCredit";
import { RichBody } from "@/components/RichBody";
import { RoutePhoto } from "@/components/RoutePhoto";
import { initLingui } from "@/i18n/server";
import { formatDay } from "@/lib/format";
import { pickText } from "@/lib/pick-text";
import { getPost } from "@/lib/posts";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i18n = await initLingui();
  const post = await getPost((await params).id);
  return { title: post ? pickText(i18n.locale, post.titleJa, post.titleEn)?.text : undefined };
}

// One blog post. A draft, or a post dated ahead, is not sent by the API, so it reads as "not found" here.
export default async function BlogPostPage({ params }: Props) {
  const i18n = await initLingui();
  const post = await getPost((await params).id);
  if (!post) notFound();

  const title = pickText(i18n.locale, post.titleJa, post.titleEn);
  const body = pickText(i18n.locale, post.bodyJa, post.bodyEn);
  const author = pickText(i18n.locale, post.authorNameJa, post.authorNameEn);

  return (
    <article className="page-narrow flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-6 px-4">
        <BackLink href="/blog">
          <Trans>ブログ</Trans>
        </BackLink>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            <Localized value={title} />
          </h1>
          <time dateTime={post.publishedOn} className="text-lg text-muted">
            {formatDay(i18n.locale, post.publishedOn)}
          </time>
        </div>
      </div>

      {post.coverPhotoUrl ? (
        <figure className="flex flex-col gap-2">
          <span className="relative block aspect-[4/3] overflow-hidden sm:rounded-xl">
            <RoutePhoto src={post.coverPhotoUrl} alt={title?.text ?? ""} />
          </span>
          <CreditCaption credit={post.coverCredit} className="px-4" />
        </figure>
      ) : null}

      {body ? (
        <div className="px-4">
          <RichBody text={body.text} lang={body.lang} anchor={post.id} />
        </div>
      ) : null}

      {author ? (
        <footer className="mx-4 flex items-center gap-3 rounded-xl bg-surface p-4">
          {post.authorPhotoUrl ? (
            <Image
              src={post.authorPhotoUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-full object-cover"
              unoptimized
            />
          ) : null}
          <p className="min-w-0 text-lg">
            <span className="text-base text-muted">
              <Trans>書いた人</Trans>
            </span>
            <br />
            <span className="font-bold">
              <Localized value={author} />
            </span>
          </p>
        </footer>
      ) : null}
    </article>
  );
}
