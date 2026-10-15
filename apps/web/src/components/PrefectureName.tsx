import { Trans } from "@lingui/react/macro";
import type { Prefecture } from "@/lib/content";

export function PrefectureName({ value }: { value: Prefecture }) {
  switch (value) {
    case "osaka":
      return <Trans>大阪府</Trans>;
    case "wakayama":
      return <Trans>和歌山県</Trans>;
    case "nara":
      return <Trans>奈良県</Trans>;
  }
}
