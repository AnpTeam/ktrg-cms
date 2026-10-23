import { fetchPublicPost, fetchPublicPosts } from "./api-content";

/**
 * A blog post, written in the admin (/admin/posts). Japanese is required and English falls back to it. The body may
 * hold the rich-text markers (links, footnotes, headings, lists, photos; see lib/rich-text.ts). The API only ever
 * sends posts that are published and dated today or earlier, so nothing here decides what a visitor may read.
 *
 * Server code only: this module is on the client-boundary list, like the content module.
 */
export interface BlogPost {
  id: string;
  titleJa: string;
  titleEn: string | null;
  bodyJa: string;
  bodyEn: string | null;
  /** A free-text byline, not an account. */
  authorNameJa: string | null;
  authorNameEn: string | null;
  /** https links, or null. */
  coverPhotoUrl: string | null;
  coverCredit: string | null;
  authorPhotoUrl: string | null;
  /** YYYY-MM-DD, Japan time: the day the post is dated. */
  publishedOn: string;
}

/** The newest posts a visitor may read; an empty list when there are none or the API cannot be reached. */
export async function listPosts(): Promise<BlogPost[]> {
  return (await fetchPublicPosts()) ?? [];
}

/** One post, or null when it is a draft, dated ahead, or not there (the page then shows "not found"). */
export async function getPost(id: string): Promise<BlogPost | null> {
  return fetchPublicPost(id);
}
