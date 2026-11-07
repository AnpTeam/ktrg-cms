"use client";

import { useEffect } from "react";

const KEY = "ktrg-session-rotate";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Asks about once a day whether the session's token is due for a change. The browser must ask itself: a page drawn on the
 * server cannot pass a new cookie on. Any failure is fine, the old token keeps working and the next day asks again.
 */
export function SessionRotate() {
  useEffect(() => {
    try {
      if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < DAY_MS) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // storage blocked: it just asks on every page load
    }
    fetch("/api/v1/auth/session/rotate", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  }, []);
  return null;
}
