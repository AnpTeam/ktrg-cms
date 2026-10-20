import { useLingui } from "@lingui/react/macro";
import type { ErrorKey } from "@/lib/api-error";

/**
 * The sentence for every error name, in the visitor's language (WBS 3.3.4). One table for the whole app, so the
 * same problem is always worded the same way. `Record<ErrorKey, string>` makes the compiler refuse a name that
 * has no sentence, and `lib/api-error.ts` refuses an API code that is not listed there.
 */
export function useErrorMessages(): Record<ErrorKey, string> {
  const { t } = useLingui();
  return {
    // Any request
    bad_request: t`送った内容が、読み取れませんでした。もう一度お試しください。`,
    validation_failed: t`入力に、まちがいがあるようです。見直して、もう一度お試しください。`,
    not_found: t`お探しのものは、見つかりませんでした。`,
    rate_limited: t`短い間に何度も操作されました。しばらくしてからお試しください。`,
    internal_error: t`こちらの問題で、うまくいきませんでした。しばらくしてからもう一度お試しください。`,
    // Login and permissions
    unauthenticated: t`ログインが切れたようです。ログインしなおしてください。`,
    forbidden: t`この操作は、できません。`,
    reauth_required: t`もう一度、本人かどうかの確認が必要です。`,
    invalid_code: t`番号が違うか、期限が切れています。もう一度お試しください。`,
    no_email: t`このアカウントには、メールがありません。顔・指紋で確認してください。`,
    no_passkey: t`このアカウントには、パスキーがありません。メールの番号で確認してください。`,
    reauth_failed: t`確認できませんでした。もう一度お試しください。`,
    // Passkeys
    login_failed: t`ログインできませんでした。この端末にパスキーがないときは、メールでログインしてください。`,
    registration_failed: t`登録できませんでした。もう一度お試しください。`,
    too_many_passkeys: t`パスキーは、これ以上ふやせません。使わないものを消してから、お試しください。`,
    last_login_method: t`ほかにログインの方法がないので、このパスキーは消せません。先にメールかほかのパスキーを使えるようにしてください。`,
    // Profile
    invalid_display_name: t`お名前に使えない文字が含まれているか、長すぎます（40文字まで）。`,
    // Admin: routes and places
    conflict: t`別の人が先に保存しました。読み込み直してから、もう一度お試しください。`,
    invalid_video_url: t`動画のリンクは、https:// で始まるYouTubeかVimeoのものだけ使えます。`,
    invalid_line: t`ルートの線が正しくありません。日本の中に、2点以上の線を描いてください。`,
    invalid_photo_url: t`写真のリンクは、https:// で始まるものだけ使えます。`,
    route_has_places: t`場所が残っているルートは消せません。先に場所を消してください。`,
    spot_has_stamps: t`スタンプが押されたことのある場所は消せません。「公開をやめる」をお使いください。`,
    no_coordinates: t`この場所の位置がまだ決まっていません。地図で位置を決めてください。`,
    position_not_verified: t`位置を公式の情報で確認していません。確認してから「位置を確認した」にチェックを入れてください。`,
    source_required: t`位置を確認した情報源（サイトの名前やリンク）を書いてください。`,
    permission_required: t`現地の許可がまだ確認できていません。許可を得たら「許可確認済み」にチェックを入れてください。`,
    // Admin: rallies
    rally_empty: t`中身のないラリーは公開できません。公開中のラリーを空にすることもできません。`,
    invalid_rally_members: t`場所でつくったラリーにはスタンプ場所を、コースでつくったラリーにはコースを入れてください。同じものは一度だけです。`,
    // Admin: lists (trail notices, ...)
    cannot_change_own_role: t`自分の権限は変えられません。ほかの管理者に頼んでください。`,
    invalid_source_url: t`出典のリンクは https:// で始まるアドレスを入れてください。`,
    // Admin: photo uploads
    invalid_file: t`写真は4MBまでのJPEG・PNG・WebPだけアップロードできます。`,
    uploads_unavailable: t`写真を保存できませんでした。しばらくしてからもう一度お試しください。`,
    // Admin: snapping a line to trails
    routing_unavailable: t`道に沿わせる機能が、まだ使えません。管理する人に、道案内サービスの設定を頼んでください。手で線を描くことはできます。`,
    routing_no_route: t`この近くに、歩ける道が見つかりませんでした。線の点を、道の近くに置いてお試しください。`,
    routing_failed: t`道を調べられませんでした。しばらくしてから、もう一度お試しください。`,
    // From the phone itself
    unsupported: t`この端末・ブラウザではパスキーを使えません。メールでお試しください。`,
    cancelled: t`パスキーの確認が中止されました。もう一度お試しください。`,
    network: t`通信できませんでした。電波の良い場所でもう一度お試しください。`,
    failed: t`問題が発生しました。しばらくしてからもう一度お試しください。`,
  };
}
