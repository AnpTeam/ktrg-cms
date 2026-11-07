"use client";

import { useLingui } from "@lingui/react/macro";
import type { Problem } from "@/lib/stamp-flow";

/** What to tell the visitor for every way a stamp can fail, in their language (the stamp button and the rally page share it). */
export function useStampMessages(): Record<Problem, string> {
  const { t } = useLingui();
  return {
    unsupported: t`この端末・ブラウザでは、位置情報を使えません。`,
    denied: t`位置情報が許可されていません。ブラウザの設定で、このサイトの位置情報を「許可」にしてから、もう一度お試しください。`,
    unavailable: t`いまの位置が、わかりません。空の開けた場所で、もう一度お試しください。`,
    timeout: t`位置を調べるのに、時間がかかっています。空の開けた場所で、もう一度お試しください。`,
    too_far: t`まだ、この場所から遠いようです。場所の近くで、もう一度お試しください。`,
    low_accuracy: t`GPSの電波が弱いようです。空の開けた場所に動いて、もう一度お試しください。`,
    spot_closed: t`この場所は、いまは閉鎖中です。スタンプは押せません。`,
    stale_scan: t`このスタンプは、押してから時間がたちすぎているため、受け付けられませんでした（48時間まで）。`,
    bad_time: t`スタンプを押した時刻が正しくありません。端末の日付と時刻を確かめてください。`,
    rally_not_active: t`このラリーは、いまは行われていません。`,
    not_ready: t`スタンプを押す機能は、まだ使えません。`,
    login_needed: t`ログインが切れたようです。ログインしなおしてください。`,
    guest_full: t`登録なしで残せるスタンプの数が、上限になりました。新規登録すると、続けて集められます。`,
    stamp_revoked: t`この場所のスタンプは、確認のため取り消されています。お困りの場合は運営にお問い合わせください。`,
    account_restricted: t`このアカウントは、いま制限されています。スタンプを押すことと、コメントを書くことはできません。`,
    too_many_requests: t`短い間に何度も操作されました。しばらくしてからお試しください。`,
    network: t`通信できませんでした。電波の良い場所でもう一度お試しください。`,
    failed: t`問題が発生しました。しばらくしてからもう一度お試しください。`,
  };
}
