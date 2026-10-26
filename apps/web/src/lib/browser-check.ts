// Browsers where the stamps of someone with no account are likely to be lost: the browser inside another app (LINE, Instagram,
// Facebook, X ...) keeps no history, and a browser that blocks cookies or storage keeps nothing. (Private mode cannot be
// told reliably from the page, so the warning text and the FAQ explain it instead.)

/** The "browser" opened inside another app, from its user agent. */
export function isInAppBrowser(ua: string): boolean {
  if (/\b(Line|Instagram|FBAN|FBAV|FB_IAB|Twitter|MicroMessenger|KAKAOTALK|Snapchat|TikTok|musical_ly|Pinterest|GSA)\b/i.test(ua)) return true;
  if (/; wv\)/.test(ua)) return true; // an Android WebView
  // iPhone and iPad web views leave out the "Safari" part that every real iPhone browser (Safari, Chrome, Firefox ...) has.
  return /\b(iPhone|iPad|iPod)\b/.test(ua) && !/Safari/.test(ua);
}

/** Whether this browser will keep a cookie and local storage across visits (a quick write and read back). */
export function canKeepData(): boolean {
  try {
    if (!navigator.cookieEnabled) return false;
    localStorage.setItem("ktrg-probe", "1");
    const ok = localStorage.getItem("ktrg-probe") === "1";
    localStorage.removeItem("ktrg-probe");
    return ok;
  } catch {
    return false;
  }
}
