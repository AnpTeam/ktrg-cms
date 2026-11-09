import { expect, test } from "bun:test";
import { afterChange, inboxQuery, initialOf, type CommentItem } from "./comment-inbox";

const c = (id: string, status: CommentItem["status"]): CommentItem => ({ id, status, createdAt: "", updatedAt: "", postId: "p", postTitle: "", postPhotoUrl: null, authorName: null, body: "" });

test("a changed comment leaves a tab it no longer belongs to, and stays in place on すべて", () => {
  const list = [c("a", "pending"), c("b", "pending")];
  expect(afterChange(list, c("a", "approved"), "pending").map((x) => x.id)).toEqual(["b"]);
  expect(afterChange(list, c("a", "approved"), "all").map((x) => x.status)).toEqual(["approved", "pending"]);
  expect(afterChange(list, c("a", "pending"), "pending")).toHaveLength(2);
});

test("the query names the tab's status, the words and the page", () => {
  expect(inboxQuery("pending", " 熊 ", 2)).toBe("q=%E7%86%8A&filter=status%3Apending&page=2");
  expect(inboxQuery("all", "", 1)).toBe("page=1");
});

test("the round mark shows the first letter of the name", () => {
  expect(initialOf("hhibii")).toBe("H");
  expect(initialOf("山田")).toBe("山");
  expect(initialOf(null)).toBe("?");
  expect(initialOf("  ")).toBe("?");
});
