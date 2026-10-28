import { describe, expect, test } from "bun:test";
import { optionsFor } from "./auth-client";

const server = {
  authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
  hints: ["client-device"],
} as unknown as Parameters<typeof optionsFor>[1];

describe("optionsFor", () => {
  test("this device keeps what the server asked for", () => {
    expect(optionsFor("here", server)).toBe(server);
  });

  test("a phone drops the platform limit and asks for the QR code, keeping the rest", () => {
    const out = optionsFor("phone", server);
    expect(out.authenticatorSelection).toEqual({ residentKey: "required", userVerification: "required" });
    expect(out.hints).toEqual(["hybrid"]);
    expect(server.authenticatorSelection?.authenticatorAttachment).toBe("platform");
  });
});
