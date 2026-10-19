import { describe, expect, test } from "bun:test";
import { signedOut, viewerFromMe } from "../viewer";
import { adminAccess } from "./access";

describe("who may open the admin area", () => {
  test("signed out goes to log in", () => {
    expect(adminAccess(signedOut)).toBe("login");
  });
  test("a participant is told it is not for them", () => {
    expect(adminAccess(viewerFromMe(200, { ok: true, me: { role: "participant" } }))).toBe("forbidden");
  });
  test("an admin gets in", () => {
    expect(adminAccess(viewerFromMe(200, { ok: true, me: { role: "admin" } }))).toBe("ok");
  });
  test("a signed-in account whose role is unknown is not let in", () => {
    expect(adminAccess(viewerFromMe(200, { ok: true, me: { role: "root" } }))).toBe("forbidden");
    expect(adminAccess({ signedIn: true, role: null })).toBe("forbidden");
  });
});
