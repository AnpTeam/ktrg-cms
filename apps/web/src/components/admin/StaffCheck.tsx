"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ReauthSteps } from "@/components/auth/ReauthDialog";
import { keepStaffCheck } from "@/lib/auth-client";

/**
 * Shown in place of the admin area every 12 hours: the face or fingerprint check, or an emailed number. Ticking the box keeps
 * this device for 30 days. An account is still logged out after 14 days without use, whatever is ticked here.
 */
export function StaffCheck() {
  const { t } = useLingui();
  const router = useRouter();
  const [keep, setKeep] = useState(false);

  async function done() {
    // If keeping the device fails the check still passed, so it only asks again sooner.
    if (keep) await keepStaffCheck();
    router.refresh();
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <div>
        <ReauthSteps onDone={done} onCancel={() => router.push("/")} />
      </div>
      <label className="tap-target flex cursor-pointer items-center gap-3 text-lg">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-6 shrink-0" />
        {t`この端末では、30日間ログインしたままにする`}
      </label>
      <p className="text-base text-muted">{t`自分だけが使う端末のときに選んでください。`}</p>
    </main>
  );
}
