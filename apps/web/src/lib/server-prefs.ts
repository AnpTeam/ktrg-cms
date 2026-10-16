import { cookies } from "next/headers";
import { effectivePrefs, parsePrefsCookie, prefsCookie, type Prefs } from "./prefs";
import { getViewer } from "./viewer";

/**
 * The visitor's accessibility and map choices for this request: the account's if signed in with
 * choices saved there, else the cookie on this device, else the defaults. Server only.
 */
export async function getPrefs(): Promise<Prefs> {
  const viewer = await getViewer();
  const device = parsePrefsCookie((await cookies()).get(prefsCookie)?.value);
  return effectivePrefs(viewer.preferences, device);
}
