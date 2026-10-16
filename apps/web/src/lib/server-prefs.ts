import { cookies } from "next/headers";
import { effectivePrefs, parsePrefsCookie, prefsCookie, type Prefs } from "./prefs";
import { getViewer } from "./viewer";

/** Both saved copies of the visitor's choices, and the one that applies. Server only. */
export async function getPrefsState(): Promise<{ account: Prefs | null; device: Prefs | null; effective: Prefs; signedIn: boolean }> {
  const viewer = await getViewer();
  const device = parsePrefsCookie((await cookies()).get(prefsCookie)?.value);
  return { account: viewer.preferences, device, effective: effectivePrefs(viewer.preferences, device), signedIn: viewer.signedIn };
}

/**
 * The visitor's accessibility and map choices for this request: the newer of the account's copy and
 * the one on this phone (see effectivePrefs), else the defaults. Server only.
 */
export async function getPrefs(): Promise<Prefs> {
  return (await getPrefsState()).effective;
}
