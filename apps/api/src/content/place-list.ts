import { eq, inArray } from "drizzle-orm";
import type { ReadDef } from "../admin-lists/list-routes";
import type { ListReader } from "../admin-lists/list-service";
import { afterCursor, newestFirst } from "../admin-lists/list-sql";
import type { Label, ListReadStore, ListRow } from "../admin-lists/list-types";
import type { KitServices } from "../auth/route-kit";
import type { Db } from "../db/client";
import { spots, spotTranslations, type spotKinds } from "../db/schema";
import { emptyTexts, flattenTexts, SPOT_TEXT } from "../db/translations";

/** A waypoint in the all-waypoints list: enough to find it and see what still blocks publishing. */
export interface PlaceListRow extends ListRow {
  routeId: string;
  nameJa: string;
  nameEn: string | null;
  kind: (typeof spotKinds)[number];
  status: "open" | "caution" | "closed";
  published: boolean;
  /** Visitors can stamp here (the switch on a waypoint). */
  stampable: boolean;
  positionVerified: boolean;
  permissionConfirmed: boolean;
}

export function createDrizzlePlaceListStore(db: Db): ListReadStore<PlaceListRow> {
  async function withNames(rows: (typeof spots.$inferSelect)[]): Promise<PlaceListRow[]> {
    if (rows.length === 0) return [];
    const names = flattenTexts(SPOT_TEXT, await db.select().from(spotTranslations).where(inArray(spotTranslations.spotId, rows.map((r) => r.id))), (t) => t.spotId);
    return rows.map((r) => {
      const n = names.get(r.id) ?? emptyTexts(SPOT_TEXT);
      return {
        id: r.id,
        routeId: r.routeId,
        nameJa: n.nameJa ?? "",
        nameEn: n.nameEn,
        kind: r.kind,
        status: r.status,
        published: r.published,
        stampable: r.stampable,
        positionVerified: r.positionVerified,
        permissionConfirmed: r.permissionConfirmed,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }
  return {
    async list(cursor, limit) {
      return withNames(
        await db.select().from(spots).where(afterCursor(spots.createdAt, spots.id, cursor)).orderBy(...newestFirst(spots.createdAt, spots.id)).limit(limit),
      );
    },
    async get(id) {
      const [row] = await db.select().from(spots).where(eq(spots.id, id)).limit(1);
      return row ? ((await withNames([row]))[0] ?? null) : null;
    },
  };
}

export interface PlaceListServices extends KitServices {
  placeList: ListReader<PlaceListRow>;
}

const KIND_LABELS: Record<PlaceListRow["kind"], Label> = {
  temple: { ja: "寺社", en: "Temple or shrine" },
  mound: { ja: "経塚", en: "Sutra mound" },
  view: { ja: "見どころ", en: "Point of interest" },
  turn: { ja: "曲がり角", en: "Turn" },
  danger: { ja: "危険な所", en: "Danger spot" },
  toilet: { ja: "トイレ", en: "Toilet" },
  rest_area: { ja: "休憩所", en: "Rest area" },
  drinking_water: { ja: "水場", en: "Drinking water" },
  vending_machine: { ja: "自動販売機", en: "Vending machines" },
  bus_stop: { ja: "バス停", en: "Bus stop" },
  station: { ja: "駅", en: "Station" },
  parking: { ja: "駐車場", en: "Parking" },
  ferry: { ja: "港・フェリー乗り場", en: "Port or ferry" },
  campsite: { ja: "キャンプ場", en: "Campsite" },
  other: { ja: "その他", en: "Other" },
};

/**
 * Every waypoint on every route in one list (`spot.manage`), newest first. Read only: a waypoint is edited in its
 * route's map editor, so a row opens there. The ticks show what still keeps it from being published.
 */
export const placeList: ReadDef<"places", PlaceListRow, PlaceListServices> = {
  key: "places",
  permission: "spot.manage",
  service: (s) => s.placeList,
  ops: { create: false, edit: false, delete: true },
  ui: {
    title: { ja: "経由地の一覧", en: "All waypoints" },
    intro: {
      ja: "すべてのルートの経由地です。名前を押すと、そのルートの地図の画面で直せます。公開するには、位置の確認（スタンプを押せる経由地は現地の許可も）が必要です。",
      en: "Every waypoint on every route. Select a name to edit it in that route's map editor. To publish a waypoint its position must be checked (and, if visitors can stamp there, the site's permission confirmed).",
    },
    deleteWarning: { ja: "この経由地を削除します。ルートの地図からも消えます。ほかのコースにも置いてある場合は、そこからも消えます。元に戻せません。よろしいですか？", en: "Delete this waypoint? It disappears from the route and its map, and from any other course it is shared with. This cannot be undone." },
    titleField: "name",
    linkTo: "routes/{routeId}",
    fields: [
      { name: "name", kind: "bilingual", label: { ja: "名前", en: "Name" }, readOnly: true },
      { name: "routeId", kind: "route", label: { ja: "ルート", en: "Route" }, readOnly: true, inList: {} },
      {
        name: "kind",
        kind: "select",
        label: { ja: "種類", en: "Kind" },
        readOnly: true,
        options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
        inList: {},
      },
      { name: "published", kind: "boolean", label: { ja: "公開", en: "Published" }, readOnly: true, inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } } },
      {
        name: "positionVerified",
        kind: "boolean",
        label: { ja: "位置を確認した", en: "Position checked" },
        readOnly: true,
        inList: { yes: { ja: "位置を確認した", en: "Position checked" }, no: { ja: "位置は未確認", en: "Position not checked" }, tone: { no: "warn" } },
      },
      {
        name: "stampable",
        kind: "boolean",
        label: { ja: "スタンプを押せる", en: "Stamp here" },
        readOnly: true,
        inList: { yes: { ja: "スタンプを押せる", en: "Stamp here" } },
      },
      {
        name: "permissionConfirmed",
        kind: "boolean",
        label: { ja: "許可確認済み", en: "Permission confirmed" },
        readOnly: true,
        inList: { yes: { ja: "許可確認済み", en: "Permission confirmed" } },
      },
      {
        name: "status",
        kind: "select",
        label: { ja: "状態", en: "Status" },
        readOnly: true,
        options: [
          { value: "open", label: { ja: "通常", en: "Normal" } },
          { value: "caution", label: { ja: "注意", en: "Caution" } },
          { value: "closed", label: { ja: "通行止め", en: "Closed" } },
        ],
        inList: {},
      },
    ],
  },
};
