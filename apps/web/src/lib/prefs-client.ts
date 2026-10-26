"use client";

import { api } from "./api";
import { prefsCookieString, type Prefs } from "./prefs";

/**
 * Saves the visitor's choices: always on this phone (the cookie the server reads), and, when signed in, on the account
 * too. Stamped with the time of the choice: the newer copy wins. Returns false when the account could not be reached
 * (the phone's copy is saved anyway and syncs later).
 */
export async function persistPrefs(value: Prefs, signedIn: boolean): Promise<boolean> {
  const toSave: Prefs = { ...value, setupDone: true, updatedAt: Date.now() };
  document.cookie = prefsCookieString(toSave, window.location.protocol === "https:");
  if (!signedIn) return true;
  try {
    return !(await api.me.patch({ preferences: toSave })).error;
  } catch {
    return false;
  }
}
