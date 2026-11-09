import type { ListItem } from "./lists/config";
import type { ListPage } from "./lists/list-client";

export type CommentStatus = "pending" | "approved" | "hidden";
/** The tabs over the comments: one status, or all of them. */
export type CommentTab = CommentStatus | "all";

export const COMMENT_TABS: readonly CommentTab[] = ["pending", "approved", "hidden", "all"];

/** A comment as the inbox reads it from the list API. */
export type CommentItem = ListItem & {
  postId: string;
  postTitle: string;
  postPhotoUrl: string | null;
  authorName: string | null;
  body: string;
  status: CommentStatus;
};

/** One page of the inbox. */
export type CommentPage = { items: CommentItem[]; page: number; pages: number; total: number };
export const commentPageOf = (data: ListPage): CommentPage => ({ items: data.items as CommentItem[], page: data.page ?? 1, pages: data.pages ?? 1, total: data.total ?? data.items.length });

/** The list's query for a tab and search words. */
export function inboxQuery(tab: CommentTab, words: string, page: number): string {
  const params = new URLSearchParams();
  if (words.trim()) params.set("q", words.trim());
  if (tab !== "all") params.set("filter", `status:${tab}`);
  params.set("page", String(page));
  return params.toString();
}

/** The rows after a comment changed: it stays in its place, or leaves when it no longer belongs to the tab (shown on 確認待ち, say). */
export function afterChange(items: readonly CommentItem[], changed: CommentItem, tab: CommentTab): CommentItem[] {
  if (tab !== "all" && changed.status !== tab) return items.filter((c) => c.id !== changed.id);
  return items.map((c) => (c.id === changed.id ? changed : c));
}

/** The first letter of a name, for the round mark beside a comment ("?" with no name). */
export const initialOf = (name: string | null): string => (name?.trim() ? [...name.trim()][0]!.toUpperCase() : "?");
