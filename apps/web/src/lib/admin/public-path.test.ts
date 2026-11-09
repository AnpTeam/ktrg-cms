import { expect, test } from "bun:test";
import { publicPathFor } from "./public-path";

test("an admin page leads to its own page on the site, or to none", () => {
  expect(publicPathFor("/admin/routes/abc")).toBe("/routes/abc");
  expect(publicPathFor("/admin/routes")).toBe("/routes");
  expect(publicPathFor("/admin/routes/new")).toBeNull();
  expect(publicPathFor("/admin/places/abc")).toBe("/spots/abc");
  expect(publicPathFor("/admin/places")).toBeNull();
  expect(publicPathFor("/admin/pages/home")).toBe("/");
  expect(publicPathFor("/admin/pages/faq")).toBe("/faq");
  expect(publicPathFor("/admin/pages")).toBeNull();
  expect(publicPathFor("/admin/posts/p1")).toBe("/blog/p1");
  expect(publicPathFor("/admin/directory/d1")).toBe("/places/d1");
  expect(publicPathFor("/admin/directory")).toBe("/places");
  expect(publicPathFor("/admin/directory/new")).toBeNull();
  expect(publicPathFor("/admin")).toBeNull();
  expect(publicPathFor("/admin/users")).toBeNull();
  expect(publicPathFor("/admin/comments")).toBeNull();
});
