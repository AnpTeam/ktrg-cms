import { fetchPostComments, fetchPublicPost, fetchPublicPosts } from "./api-content";

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
  /** The directory place the post is about (its details and nearby places show under the text), or null. */
  placeId: string | null;
  /** The route and the waypoint (or sutra mound) it is about, or null: cards for them show under the text. */
  routeId: string | null;
  spotId: string | null;
  /** YYYY-MM-DD, Japan time: the day the post is dated. */
  publishedOn: string;
  /** The post's tags (missing in an answer from before tags). */
  tags?: PostTag[];
}

export type PostTag = { id: string; nameJa: string; nameEn: string | null };

/** Every tag on these posts, once each, in the order they first appear. */
export function tagsOf(posts: readonly BlogPost[]): PostTag[] {
  const seen = new Map<string, PostTag>();
  for (const p of posts) for (const t of p.tags ?? []) if (!seen.has(t.id)) seen.set(t.id, t);
  return [...seen.values()];
}

/** The newest posts a visitor may read; an empty list when there are none or the API cannot be reached. */
export async function listPosts(tag?: string): Promise<BlogPost[]> {
  return (await fetchPublicPosts(tag)) ?? [];
}

/** One post, or null when it is a draft, dated ahead, or not there (the page then shows "not found"). */
export async function getPost(id: string): Promise<BlogPost | null> {
  return fetchPublicPost(id);
}

export interface PostComment {
  id: string;
  body: string;
  /** The writer's profile name; null when they have none. */
  authorName: string | null;
  createdAt: string;
}

/** The approved comments under a post, oldest first. */
export const listComments = (id: string): Promise<PostComment[]> => fetchPostComments(id);

/** The posts before and after this one in the blog (newer, older), for the links at the end of a post. */
export function neighbours(posts: readonly BlogPost[], id: string): { newer: BlogPost | null; older: BlogPost | null } {
  const at = posts.findIndex((p) => p.id === id);
  return at < 0 ? { newer: null, older: null } : { newer: posts[at - 1] ?? null, older: posts[at + 1] ?? null };
}
