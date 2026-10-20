"use client";

import { useLingui } from "@lingui/react/macro";
import type { ChecklistId, EditorTab } from "@/lib/admin/checklist";

// The words for the checklist items and the editor tabs, shared by the route list and the editor.
export function useChecklistLabels(): { item: Record<ChecklistId, string>; tab: Record<EditorTab, string> } {
  const { t } = useLingui();
  return {
    item: {
      name_ja: t`ルート名（日本語）`,
      description_ja: t`説明文（日本語）`,
      line_checked: t`ルートの線を確認済み`,
      places_published: t`公開中のスタンプの経由地`,
      prefecture: t`都道府県`,
      english: t`英語の名前と説明`,
      history: t`歴史・由来`,
      access: t`アクセス・交通`,
      photo: t`写真`,
      video: t`動画`,
    },
    tab: { overview: t`概要`, text: t`文章`, map: t`地図と線`, places: t`経由地`, check: t`チェック` },
  };
}
