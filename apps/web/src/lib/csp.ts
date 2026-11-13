// The page's Content-Security-Policy: what the browser may load, so a script that sneaks in cannot call or send data just anywhere.
// Pure, so it is tested (csp.test.ts) and used by next.config.ts.

/** The host the admin's video upload goes to: the signed address is https://<bucket>.<account>.r2.cloudflarestorage.com/... */
const R2_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Everything the pages load from outside: GSI map tiles, the admin's place search (Nominatim) and photo finder
 * (Wikipedia / Wikimedia Commons), YouTube embeds, and the admin's video upload straight to R2 (connect-src) and
 * its playback (media-src). Photos may come from any https address until PHOTO_HOSTS is set (the API's setting).
 * 'unsafe-inline' scripts: Next writes small inline scripts; a nonce needs every page to render per request.
 *
 * `r2UploadHost` (env R2_UPLOAD_HOST, set when the web app is built): your own bucket's upload host. Set, only that host may
 * be sent files; unset, any R2 bucket is allowed (so a stray script could send data to someone else's bucket).
 *
 * `r2PublicHost` (env R2_PUBLIC_HOST): the host the uploaded files are read from (the bucket's public address, such as
 * pub-xxxx.r2.dev, or your own domain for it). The browser loads a video's subtitle file (.vtt) as a connection, so connect-src
 * must list it or the subtitles never show. Unset, any *.r2.dev host is allowed.
 */
export function buildCsp({ isProd, r2UploadHost, r2PublicHost }: { isProd: boolean; r2UploadHost?: string; r2PublicHost?: string }): string {
  const host = r2UploadHost?.trim();
  if (host && !R2_HOST.test(host)) throw new Error("R2_UPLOAD_HOST must be a host name such as my-bucket.1234abcd.r2.cloudflarestorage.com (no https://, no path)");
  const r2 = host ? `https://${host}` : "https://*.r2.cloudflarestorage.com";
  const publicHost = r2PublicHost?.trim();
  if (publicHost && !R2_HOST.test(publicHost)) throw new Error("R2_PUBLIC_HOST must be a host name such as pub-1234abcd.r2.dev (no https://, no path)");
  const r2Public = publicHost ? `https://${publicHost}` : "https://*.r2.dev";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://cyberjapandata.gsi.go.jp https://maps.gsi.go.jp https://nominatim.openstreetmap.org https://*.wikipedia.org https://commons.wikimedia.org https://*.tile.opentopomap.org ${r2} ${r2Public}${isProd ? "" : " ws: http://localhost:*"}`,
    "media-src 'self' https:",
    "worker-src 'self' blob:",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
