import Link from "next/link";
import { Trans } from "@lingui/react/macro";

/**
 * The route as a GPX file for the walker's own GPS device or app. Only for signed-in visitors (the API refuses others):
 * a signed-out visitor is asked to sign in instead. Shown only when the route has a checked line.
 */
export function GpxDownload({ routeId, signedIn }: { routeId: string; signedIn: boolean }) {
  return (
    <p className="px-4 text-lg print:hidden">
      {signedIn ? (
        <a href={`/api/v1/routes/${encodeURIComponent(routeId)}/gpx`} download className="tap-target inline-flex items-center font-bold text-accent underline">
          <Trans>GPXファイルをダウンロード</Trans>
        </a>
      ) : (
        <Link href="/login" className="tap-target inline-flex items-center font-bold text-accent underline">
          <Trans>ログインすると、GPXファイルをダウンロードできます</Trans>
        </Link>
      )}
    </p>
  );
}
