/**
 * The caller's IP for rate limiting.
 *
 * Behind a trusted reverse proxy (Vercel, a load balancer) set TRUST_PROXY and
 * the address that proxy appended is used: the LAST X-Forwarded-For entry, since
 * anything before it was sent by the client and can be forged. Without a trusted
 * proxy the header is ignored, so it cannot be used to dodge a limit.
 */
export function clientIp(opts: {
  headers: Record<string, string | undefined>;
  requestIp?: string | null;
  trustProxy: boolean;
}): string {
  if (opts.trustProxy) {
    const last = opts.headers["x-forwarded-for"]
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .at(-1);
    if (last) return last;
  }
  // "unknown" is one shared bucket: it fails strict rather than open.
  return opts.requestIp ?? "unknown";
}
