import { Trans } from "@lingui/react/macro";
import type { SpotStatus } from "@/lib/content";
import { CheckIcon, ClosedIcon, WarningIcon } from "./icons";

// Kept in its own file on purpose: client components (the map's stop card) import it, and it
// must not pull the content module, and with it the sample data, into the browser bundle.
/** The word for a status, with its icon: a colour never stands alone. */
export function StatusWord({ status }: { status: SpotStatus }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1 font-bold">
        <ClosedIcon />
        <Trans>閉鎖中</Trans>
      </span>
    );
  }
  if (status === "caution") {
    return (
      <span className="inline-flex items-center gap-1 font-bold">
        <span className="text-caution">
          <WarningIcon />
        </span>
        <Trans>注意</Trans>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-bold text-moss">
      <CheckIcon />
      <Trans>開放中</Trans>
    </span>
  );
}
