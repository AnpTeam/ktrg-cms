import Link from "next/link";
import { Trans } from "@lingui/react/macro";

const button = "tap-target inline-flex min-h-14 w-full items-center justify-center rounded-xl border border-ink bg-paper px-6 text-xl font-bold text-ink hover:bg-surface sm:w-auto";

/**
 * The route as a GPX file for the walker's own GPS device or app, as a button. Only for signed-in visitors (the API
 * refuses others): a signed-out visitor sees the same button, which takes them to sign in and then back to this route,
 * with a quiet note saying why. Shown only when the route has a checked line.
 */
export function GpxDownload({ routeId, signedIn }: { routeId: string; signedIn: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 print:hidden">
      {signedIn ? (
        <a href={`/api/v1/routes/${encodeURIComponent(routeId)}/gpx`} download className={button}>
          <Trans>GPXファイルをダウンロード</Trans>
        </a>
      ) : (
        <>
          <Link href={`/login?next=${encodeURIComponent(`/routes/${routeId}`)}`} className={button}>
            <Trans>GPXファイルをダウンロード</Trans>
          </Link>
          <p className="text-base text-muted">
            <Trans>ログインすると、ダウンロードできます。</Trans>
          </p>
        </>
      )}
    </div>
  );
}
