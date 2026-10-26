import { track as vercelTrack } from "@vercel/analytics";

/**
 * Counts one thing that happened (a step of the first-open flow, a stamp), with no personal data and no way to tell who:
 * Vercel Analytics custom events. It does nothing off Vercel or while developing, and never throws.
 */
export function track(name: string, data?: Record<string, string | number | boolean>) {
  try {
    vercelTrack(name, data);
  } catch {
    // counting must never get in the way of the page
  }
}
