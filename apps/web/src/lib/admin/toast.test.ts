import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { readToast, showToast, subscribeToast, TOAST_OK_MS } from "./toast";

beforeEach(() => {
  jest.useFakeTimers();
  showToast(null);
});
afterEach(() => jest.useRealTimers());

test("good news closes itself; an error stays", () => {
  showToast({ kind: "ok", text: "saved" });
  jest.advanceTimersByTime(TOAST_OK_MS - 1);
  expect(readToast()?.text).toBe("saved");
  jest.advanceTimersByTime(1);
  expect(readToast()).toBeNull();

  showToast({ kind: "error", text: "failed" });
  jest.advanceTimersByTime(TOAST_OK_MS * 10);
  expect(readToast()?.text).toBe("failed");
});

test("a new message replaces the last, and an old timer cannot close it", () => {
  showToast({ kind: "ok", text: "first" });
  jest.advanceTimersByTime(TOAST_OK_MS - 1);
  showToast({ kind: "error", text: "second" });
  jest.advanceTimersByTime(TOAST_OK_MS);
  expect(readToast()?.text).toBe("second");
});

test("the same words again are a new message, and listeners hear of it", () => {
  let heard = 0;
  const stop = subscribeToast(() => heard++);
  showToast({ kind: "error", text: "same" });
  const first = readToast()!.id;
  showToast({ kind: "error", text: "same" });
  expect(readToast()!.id).not.toBe(first);
  expect(heard).toBe(2);
  stop();
  showToast(null);
  expect(heard).toBe(2);
});
