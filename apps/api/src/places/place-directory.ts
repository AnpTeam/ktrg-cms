import { Elysia, t, type Static } from "elysia";
import { createMemoryListStore } from "../admin-lists/list-memory-store";
import type { ListDef } from "../admin-lists/list-routes";
import { createListService } from "../admin-lists/list-service";
import { bad, ok, type Label, type ListRow, type ListRules, type ListStore } from "../admin-lists/list-types";
import type { AuditWriter } from "../audit/audit-log";
import type { KitServices } from "../auth/route-kit";
import { cleanTranslations } from "../db/translations";
import { placeCategories } from "../db/schema";
import { isPhotoUrl } from "../lib/https-url";
import { translationsSchema } from "../lib/schemas";

const maybe = (max: number) => t.Union([t.String({ maxLength: max }), t.Null()]);

/**
 * A place in the directory (shops, cafes, toilets, vending machines ... along the courses). The words are flat
 * (`nameJa`, `nameEn` ...) and the other content languages ride in `translations`, like the other generated lists.
 */
export const PLACE_FIELDS = {
  category: t.UnionEnum([...placeCategories]),
  routeId: t.Union([t.String({ format: "uuid" }), t.Null()]),
  nameJa: t.String({ minLength: 1, maxLength: 200 }),
  nameEn: maybe(200),
  descriptionJa: maybe(2000),
  descriptionEn: maybe(2000),
  hoursJa: maybe(300),
  hoursEn: maybe(300),
  closedDaysJa: maybe(200),
  closedDaysEn: maybe(200),
  translations: t.Optional(translationsSchema({ name: 200, description: 2000, hours: 300, closedDays: 200 })),
  lat: t.Union([t.Number({ minimum: -90, maximum: 90 }), t.Null()]),
  lng: t.Union([t.Number({ minimum: -180, maximum: 180 }), t.Null()]),
  positionVerified: t.Boolean(),
  positionSource: maybe(200),
  address: maybe(300),
  phone: maybe(40),
  website: maybe(500),
  photoUrl: maybe(500),
  /** Who took the photo / where it is from (may hold links). */
  photoCredit: t.Optional(maybe(500)),
  status: t.UnionEnum(["open", "closed", "seasonal", "gone", "unknown"]),
  lastVerified: t.Union([t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }), t.Null()]),
  listingConfirmed: t.Boolean(),
  listingNote: maybe(200),
  published: t.Boolean(),
};

const placeFields = t.Object(PLACE_FIELDS);
export type PlaceFields = Static<typeof placeFields>;
export type PlaceRow = ListRow & PlaceFields;

export interface PlaceStore extends ListStore<PlaceRow, PlaceFields> {
  /** Published places, newest first (the caller drops the ones without a position). */
  listPublic(): Promise<PlaceRow[]>;
}

export const PLACE_AUDIT = { create: "place.create", update: "place.update", delete: "place.delete" } as const;

const isWebLink = (v: string) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

const NULLABLE_TEXT = ["nameEn", "descriptionJa", "descriptionEn", "hoursJa", "hoursEn", "closedDaysJa", "closedDaysEn", "positionSource", "address", "phone", "website", "photoUrl", "photoCredit", "listingNote"] as const;

/**
 * Trims every text and clears a blank one; a link must be https; a position needs both numbers; "checked" needs a
 * position and the source named; publishing needs a checked position and the owner's agreement to be listed.
 */
export const placeRules = (photoHosts: readonly string[] = [], routeExists?: (id: string) => Promise<boolean>): ListRules<PlaceFields> => async (fields) => {
  const out: Record<string, unknown> = { ...fields };
  for (const name of NULLABLE_TEXT) if (typeof out[name] === "string") out[name] = (out[name] as string).trim() || null;
  if (typeof out.nameJa === "string") {
    out.nameJa = out.nameJa.trim();
    if (out.nameJa === "") return bad("validation_failed");
  }
  if (out.translations !== undefined) out.translations = cleanTranslations(out.translations as PlaceFields["translations"]);
  const f = out as Partial<PlaceFields>;
  // A shop's own site is often plain http; it is only a link out, never loaded into our pages.
  if (typeof f.website === "string" && !isWebLink(f.website)) return bad("invalid_source_url");
  if (typeof f.photoUrl === "string" && !isPhotoUrl(f.photoUrl, photoHosts)) return bad("invalid_photo_url");
  if (f.lat !== undefined && f.lng !== undefined && (f.lat === null) !== (f.lng === null)) return bad("validation_failed");
  // An unknown route would fail the foreign key inside the write and answer 500.
  if (typeof f.routeId === "string" && routeExists && !(await routeExists(f.routeId))) return bad("validation_failed");
  if (f.positionVerified) {
    if (f.lat === null) return bad("no_coordinates");
    if (f.positionSource === null) return bad("source_required");
  }
  if (f.published) {
    if (f.lat === null) return bad("no_coordinates");
    if (!f.positionVerified) return bad("position_not_verified");
    if (!f.listingConfirmed) return bad("permission_required");
  }
  return ok(f);
};

export type PlaceService = ReturnType<typeof createPlaceService>;

export function createPlaceService(deps: { store: PlaceStore; photoHosts?: readonly string[]; routeExists?: (id: string) => Promise<boolean> }) {
  return {
    ...createListService({ store: deps.store, rules: placeRules(deps.photoHosts, deps.routeExists) }),
    /** What visitors see: published places with a checked position (the database also refuses to publish others). */
    async publicPlaces(routeId?: string): Promise<PlaceRow[]> {
      return (await deps.store.listPublic()).filter((p) => p.lat !== null && p.positionVerified && (routeId === undefined || p.routeId === routeId));
    },
  };
}

/** In-memory places for tests and the dev page. */
export function createMemoryPlaceStore(audit: AuditWriter, opts: { now?: () => Date } = {}) {
  const list = createMemoryListStore<PlaceFields>(audit, PLACE_AUDIT, opts);
  const store: PlaceStore = {
    ...list.store,
    async listPublic() {
      return [...list.rows.values()].filter((p) => p.published).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
  return { store, rows: list.rows };
}

export interface PlaceServices extends KitServices {
  places: PlaceService;
}

const CATEGORY_LABELS: Record<(typeof placeCategories)[number], Label> = {
  souvenir_shop: { ja: "お土産店", en: "Souvenir shop" },
  restaurant: { ja: "飲食店", en: "Restaurant" },
  cafe: { ja: "カフェ・喫茶", en: "Cafe" },
  convenience_store: { ja: "コンビニ・商店", en: "Store" },
  toilet: { ja: "トイレ", en: "Toilet" },
  rest_area: { ja: "休憩所・東屋", en: "Rest area" },
  drinking_water: { ja: "水場", en: "Drinking water" },
  vending_machine: { ja: "自動販売機", en: "Vending machine" },
  station: { ja: "駅", en: "Station" },
  bus_stop: { ja: "バス停", en: "Bus stop" },
  parking: { ja: "駐車場", en: "Parking" },
  other: { ja: "その他", en: "Other" },
};

/** The places directory as an admin list (`spot.manage`): shops, cafes, toilets, vending machines along the courses. */
export const placeDirectoryList: ListDef<"directory", typeof PLACE_FIELDS, PlaceRow, PlaceServices> = {
  key: "directory",
  permission: "spot.manage",
  fields: PLACE_FIELDS,
  service: (s) => s.places,
  ops: { create: true, edit: true, delete: true },
  ui: {
    title: { ja: "場所の一覧", en: "Places directory" },
    intro: {
      ja: "コースの近くのお店・カフェ・トイレ・自動販売機などです（経由地とは別のものです）。公開するには、位置を確認し、掲載の了承（公共の施設は「不要」とメモ）を入れてください。営業時間は変わりやすいので、確認した日も入れておきましょう。",
      en: "Shops, cafes, toilets, vending machines and the like near the courses (separate from a route's waypoints). To publish one, check its position and record the owner's agreement to be listed (for a public facility, note that none is needed). Opening hours change, so also record the day you checked.",
    },
    newLabel: { ja: "新しい場所", en: "New place" },
    deleteWarning: { ja: "この場所を削除します。よろしいですか？", en: "Delete this place?" },
    titleField: "name",
    fields: [
      {
        name: "category",
        kind: "select",
        label: { ja: "種類", en: "Category" },
        options: placeCategories.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
        inList: {},
      },
      { name: "name", kind: "bilingual", label: { ja: "名前", en: "Name" }, required: true },
      { name: "routeId", kind: "route", label: { ja: "近いルート", en: "Nearby route" }, noneLabel: { ja: "（なし）", en: "(none)" }, inList: {} },
      { name: "description", kind: "bilingual-long", label: { ja: "説明", en: "Description" } },
      { name: "hours", kind: "bilingual", label: { ja: "営業時間・利用時間", en: "Opening hours" } },
      { name: "closedDays", kind: "bilingual", label: { ja: "休業日", en: "Closed days" } },
      {
        name: "status",
        kind: "select",
        label: { ja: "いまの状態", en: "Status" },
        options: [
          { value: "unknown", label: { ja: "未確認", en: "Not checked" } },
          { value: "open", label: { ja: "営業中・利用可", en: "Open" } },
          { value: "closed", label: { ja: "休業中", en: "Closed" } },
          { value: "seasonal", label: { ja: "季節営業", en: "Seasonal" } },
          { value: "gone", label: { ja: "閉店・撤去", en: "Gone" } },
        ],
        inList: {},
      },
      { name: "lastVerified", kind: "date", optional: true, label: { ja: "最後に確認した日", en: "Last checked on" }, inList: { text: { ja: "確認 {value}", en: "Checked {value}" } } },
      { name: "address", kind: "text", label: { ja: "住所", en: "Address" } },
      { name: "phone", kind: "text", label: { ja: "電話番号", en: "Phone" } },
      { name: "website", kind: "url", label: { ja: "Webサイト", en: "Website" } },
      { name: "photoUrl", kind: "image", label: { ja: "写真", en: "Photo" } },
      {
        name: "photoCredit",
        kind: "text",
        label: { ja: "写真の出どころ", en: "Photo credit" },
        hint: { ja: "写真の下に表示されます。リンクは [表示する文字](https://…) の形で書けます。", en: "Shown under the photo. A link is written [text](https://…)." },
      },
      { name: "lat", kind: "decimal", label: { ja: "緯度", en: "Latitude" }, hint: { ja: "地図アプリで確かめた値を入れてください。推測では入れません。", en: "Use a value checked on a map app. Never guess." } },
      { name: "lng", kind: "decimal", label: { ja: "経度", en: "Longitude" } },
      { name: "positionSource", kind: "text", label: { ja: "位置の出どころ", en: "Where the position comes from" } },
      {
        name: "positionVerified",
        kind: "boolean",
        label: { ja: "位置を確認した", en: "Position checked" },
        inList: { yes: { ja: "位置を確認した", en: "Position checked" }, no: { ja: "位置は未確認", en: "Position not checked" } },
      },
      {
        name: "listingConfirmed",
        kind: "boolean",
        label: { ja: "掲載の了承を得た（公共の施設は不要）", en: "Agreed to be listed (not needed for a public facility)" },
        inList: { yes: { ja: "掲載の了承あり", en: "Listing agreed" } },
      },
      { name: "listingNote", kind: "text", label: { ja: "了承した人・日付のメモ", en: "Who agreed, and when" } },
      { name: "published", kind: "boolean", label: { ja: "公開する", en: "Publish" }, inList: { yes: { ja: "公開中", en: "Published" }, no: { ja: "下書き", en: "Draft" } } },
    ],
  },
};

/** What visitors get: published places with a checked position, without the admin's fields. `?route=<id>` keeps one course's. */
export function publicPlaceRoutes(getPlaces: () => PlaceService) {
  return new Elysia({ detail: { tags: ["Content"] } }).get(
    "/places",
    async ({ query }) => ({
      ok: true as const,
      // shortcut: the whole list in one answer, fine for a few hundred places; add a map-box filter and paging before thousands.
      places: (await getPlaces().publicPlaces(query.route)).slice(0, 1000).map((p) => ({
        id: p.id,
        category: p.category,
        routeId: p.routeId,
        nameJa: p.nameJa,
        nameEn: p.nameEn,
        descriptionJa: p.descriptionJa,
        descriptionEn: p.descriptionEn,
        hoursJa: p.hoursJa,
        hoursEn: p.hoursEn,
        closedDaysJa: p.closedDaysJa,
        closedDaysEn: p.closedDaysEn,
        lat: p.lat!,
        lng: p.lng!,
        address: p.address,
        phone: p.phone,
        website: p.website,
        photoUrl: p.photoUrl,
        photoCredit: p.photoCredit,
        status: p.status,
        lastVerified: p.lastVerified,
      })),
    }),
    { query: t.Object({ route: t.Optional(t.String({ format: "uuid" })) }) },
  );
}
