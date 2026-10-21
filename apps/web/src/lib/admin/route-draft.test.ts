import { describe, expect, test } from "bun:test";
import { draftFromServer, draftReducer, emptyDraft, initialState, isDirty, placeFromServer, previewRoute, publishBlockers, type DraftAction, type DraftState } from "./route-draft";
import { draftProblems, placeChanged, planSave, placeBody, routeBody, videoLinkLooksValid, withLegIds } from "./save-plan";
import type { AdminRoute, AdminSpot } from "./types";

const run = (state: DraftState, ...actions: DraftAction[]) => actions.reduce(draftReducer, state);
const fresh = () => initialState(emptyDraft());

const serverRoute = (over: Partial<AdminRoute> = {}): AdminRoute => ({
  id: "r1", nameJa: "甲山から孝子越え", nameEn: null, translations: {}, descriptionJa: null, descriptionEn: null, distanceKm: null, elevationGainM: null,
  difficulty: null, expectedTimeMin: null, prefecture: "wakayama", municipality: null, geometry: null, lineVerified: false, lineSource: null,
  videoUrl: null, historyJa: null, historyEn: null, accessJa: null, accessEn: null, photoUrl: null, sortOrder: 2, createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z", ...over,
});
const serverSpot = (id: string, over: Partial<AdminSpot> = {}): AdminSpot => ({
  id, routeId: "r1", nameJa: "虎島の経塚", nameEn: null, translations: {}, descriptionJa: null, descriptionEn: null, historyJa: null, historyEn: null, lat: null, lng: null, positionVerified: false,
  positionSource: null, radiusM: 50, kind: "mound", stampable: true, stopBy: false, photoUrl: null, photos: [], status: "open", statusNoteJa: null, statusNoteEn: null, statusUpdatedAt: null, sortOrder: 1, published: false,
  permissionConfirmed: false, permissionNote: null, createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z", ...over,
});

describe("legs", () => {
  const withStops = () => run(fresh(), { type: "addPlace", key: "a", lat: 34, lng: 135 }, { type: "addPlace", key: "b", lat: 34.01, lng: 135.01 }, { type: "addPlace", key: "c", lat: 34.02, lng: 135 });
  const legOf = (s: DraftState, from: string, to: string) => s.present.legs.find((l) => l.from === from && l.to === to);

  test("a track drawn before the stops exist is cut as soon as there are two", () => {
    let s = run(fresh(), { type: "line", points: [[135, 34], [135.005, 34.005], [135.01, 34.01]] });
    expect(s.present.legs).toEqual([]);
    expect(s.present.line).toHaveLength(3);
    s = run(s, { type: "addPlace", key: "a", lat: 34, lng: 135 }, { type: "addPlace", key: "b", lat: 34.01, lng: 135.01 });
    expect(s.present.legs.map((l) => [l.from, l.to])).toEqual([["a", "b"]]);
    expect(s.present.line).toHaveLength(3);
  });
  test("a leg replaces only its own pair; the line is the legs joined, a pair without a leg is bridged straight", () => {
    let s = withStops();
    expect(s.present.line).toEqual([]); // no leg yet: no line
    s = run(s, { type: "setLeg", leg: { from: "a", to: "b", points: [[135, 34], [135.002, 34.006], [135.01, 34.01]] } });
    expect(s.present.line).toEqual([[135, 34], [135.002, 34.006], [135.01, 34.01], [135, 34.02]]); // b to c has no leg yet: a straight hop
    s = run(s, { type: "setLeg", leg: { from: "b", to: "c", points: [[135.01, 34.01], [135.008, 34.016], [135, 34.02]] } });
    const before = legOf(s, "a", "b");
    s = run(s, { type: "setLeg", leg: { from: "b", to: "c", points: [[135.01, 34.01], [135, 34.02]] } });
    expect(legOf(s, "a", "b")).toBe(before); // redrawing one leg leaves the other untouched
    expect(s.present.line).toHaveLength(4);
    expect(s.present.distanceKm).toBeGreaterThan(2);
  });
  test("a moved stop pulls the ends of its two legs and cancels the line check; removing it joins them", () => {
    let s = run(withStops(), { type: "setLegs", legs: [{ from: "a", to: "b", points: [[135, 34], [135.005, 34.002], [135.01, 34.01]] }, { from: "b", to: "c", points: [[135.01, 34.01], [135.004, 34.016], [135, 34.02]] }] });
    s = run(s, { type: "text", field: "lineSource", value: "公式" }, { type: "lineVerified", value: true });
    s = run(s, { type: "movePlace", key: "b", lat: 34.012, lng: 135.012 });
    expect(legOf(s, "a", "b")!.points.at(-1)).toEqual([135.012, 34.012]);
    expect(legOf(s, "b", "c")!.points[0]).toEqual([135.012, 34.012]);
    expect(s.present.lineVerified).toBe(false);
    s = run(s, { type: "removePlace", key: "b" });
    expect(s.present.legs.map((l) => [l.from, l.to])).toEqual([["a", "c"]]);
    expect(s.present.line[0]).toEqual([135, 34]);
    expect(s.present.line.at(-1)).toEqual([135, 34.02]);
  });
  test("an end point added at the start's own position is not a stamp place, and the legs come back to the start", () => {
    let s = withStops(); // a, b, c
    s = run(s, { type: "addPlace", key: "end", lat: 34, lng: 135, kind: "other", patch: { stampable: false, nameJa: "出発点（終点）", positionVerified: true, positionSource: "公式" } });
    const end = s.present.places.find((p) => p.key === "end")!;
    expect([end.stampable, end.lat, end.lng, end.positionVerified, end.positionSource, end.nameJa]).toEqual([false, 34, 135, true, "公式", "出発点（終点）"]);
    s = run(s, { type: "setLeg", leg: { from: "c", to: "end", points: [[135, 34.02], [135, 34]] } });
    expect(s.present.legs.map((l) => [l.from, l.to])).toEqual([["c", "end"]]);
    expect(s.present.line.at(-1)).toEqual([135, 34]);
    // one step to undo
    expect(run(s, { type: "undo" }).present.legs).toEqual([]);
  });
  test("heights go back into the legs, and one undo takes back one leg", () => {
    let s = run(withStops(), { type: "setLeg", leg: { from: "a", to: "b", points: [[135, 34], [135.01, 34.01]] } });
    const heights = s.present.line.map((p, i): [number, number, number] => [p[0], p[1], 100 * (i + 1)]);
    s = run(s, { type: "elevations", points: heights });
    expect(s.present.legs[0]!.points.map((p) => p[2])).toEqual([100, 200]);
    s = run(s, { type: "setLeg", leg: { from: "b", to: "c", points: [[135.01, 34.01], [135, 34.02]] } }, { type: "undo" });
    expect(s.present.legs.map((l) => l.to)).toEqual(["b"]);
  });
  test("a saved route cut in one piece is cut at its stops when opened, and saved legs are read back by their ids", () => {
    const spots = [serverSpot("s1", { lat: 34, lng: 135 }), serverSpot("s2", { lat: 34.01, lng: 135.01 })];
    const plain = draftFromServer(serverRoute({ geometry: { type: "LineString", coordinates: [[135, 34], [135.004, 34.004], [135.01, 34.01]] } }), spots);
    expect(plain.legs.map((l) => [l.from, l.to])).toEqual([["s1", "s2"]]);
    const drawn = draftFromServer(serverRoute({ geometry: { type: "LineString", coordinates: [[135, 34], [135.01, 34.01]], legs: [{ from: "s1", to: "s2", coordinates: [[135, 34], [135.003, 34.007], [135.01, 34.01]] }] } }), spots);
    expect(drawn.legs[0]!.points).toHaveLength(3);
    expect(drawn.line).toHaveLength(3); // the line is what the legs make
  });
});

describe("saving legs", () => {
  const spots = [serverSpot("s1", { lat: 34, lng: 135 }), serverSpot("s2", { lat: 34.01, lng: 135.01 })];
  const legged = () => draftFromServer(serverRoute({ geometry: { type: "LineString", coordinates: [[135, 34], [135.01, 34.01]], legs: [{ from: "s1", to: "s2", coordinates: [[135, 34], [135.003, 34.007], [135.01, 34.01]] }] } }), spots);

  test("the line is sent with its legs, only when it changed", () => {
    const saved = legged();
    expect(routeBody(saved).geometry?.legs).toHaveLength(1);
    expect(planSave(saved, saved)).toEqual([]);
    const redrawn = run(initialState(saved), { type: "setLeg", leg: { from: "s1", to: "s2", points: [[135, 34], [135.006, 34.003], [135.01, 34.01]] } }).present;
    const [step] = planSave(redrawn, saved);
    expect(step).toMatchObject({ op: "updateRoute" });
    expect((step as { body: { geometry?: { legs?: unknown[] } } }).body.geometry?.legs).toHaveLength(1);
  });
  test("when a waypoint of a leg is new, the line is saved after the waypoints are, and the keys become ids", () => {
    const saved = legged();
    const s = run(initialState(saved), { type: "addPlace", key: "new", lat: 34.02, lng: 135 }, { type: "setLeg", leg: { from: "s2", to: "new", points: [[135.01, 34.01], [135, 34.02]] } });
    const steps = planSave(s.present, saved);
    // the distance and time go first; the line itself waits for the new waypoint's id
    expect(steps.map((x) => x.op)).toEqual(["updateRoute", "createSpot", "updateRoute"]);
    expect("geometry" in (steps[0] as { body: object }).body).toBe(false);
    const last = steps.at(-1) as { body: { geometry?: unknown; lineVerified?: boolean } };
    expect(last.body.geometry).toBeTruthy();
    expect(last.body.lineVerified).toBe(false);
    const ids = new Map<string, string | null>([["s1", "s1"], ["s2", "s2"], ["new", "id-new"]]);
    const sent = withLegIds(last.body as { geometry: ReturnType<typeof routeBody>["geometry"] }, ids).geometry!;
    expect(sent.legs?.map((l) => [l.from, l.to])).toEqual([["s1", "s2"], ["s2", "id-new"]]);
    // a waypoint that has no id yet leaves its legs out instead of sending a key the API does not know
    const early = withLegIds(last.body as { geometry: ReturnType<typeof routeBody>["geometry"] }, new Map([["s1", "s1"], ["s2", "s2"], ["new", null]])).geometry!;
    expect(early.legs?.map((l) => l.to)).toEqual(["s2"]);
  });
  test("a new route is created first and gets its legs once its waypoints exist", () => {
    const s = run(fresh(), { type: "text", field: "nameJa", value: "新しいルート" }, { type: "addPlace", key: "a", lat: 34, lng: 135 }, { type: "addPlace", key: "b", lat: 34.01, lng: 135.01 }, { type: "setLeg", leg: { from: "a", to: "b", points: [[135, 34], [135.01, 34.01]] } });
    expect(planSave(s.present, null).map((x) => x.op)).toEqual(["createRoute", "createSpot", "createSpot", "updateRoute"]);
  });
});

describe("drawing", () => {
  test("a line sets the distance, redrawing cancels the check, and a typed distance is kept", () => {
    let s = run(fresh(), { type: "line", points: [[135, 34], [135, 34.01]] });
    expect(s.present.distanceKm).toBe(1.11);
    s = run(s, { type: "text", field: "lineSource", value: "公式" }, { type: "lineVerified", value: true });
    expect(s.present.lineVerified).toBe(true);
    s = run(s, { type: "line", points: [[135, 34], [135, 34.02]] });
    expect(s.present.lineVerified).toBe(false);
    expect(s.present.distanceKm).toBe(2.22);
    s = run(s, { type: "distance", value: 9.3 }, { type: "line", points: [[135, 34], [135, 34.03]] });
    expect(s.present.distanceKm).toBe(9.3);
  });
  test("emptying a typed distance or climb hands the number back to the line", () => {
    let s = run(fresh(), { type: "line", points: [[135, 34, 100], [135, 34.01, 400]] });
    s = run(s, { type: "distance", value: 9.3 }, { type: "climb", value: 5 });
    expect([s.present.distanceKm, s.present.elevationGainM]).toEqual([9.3, 5]);
    s = run(s, { type: "distance", value: null }, { type: "climb", value: null });
    expect(s.present.distanceKm).toBe(1.11);
    expect(s.present.elevationGainM).toBeGreaterThan(200);
    expect([s.present.distanceManual, s.present.climbManual]).toEqual([false, false]);
    const none = run(fresh(), { type: "distance", value: null });
    expect(none.present.distanceKm).toBeNull();
  });
  test("the climb follows the elevations unless typed", () => {
    const s = run(fresh(), { type: "line", points: [[135, 34, 100], [135, 34.01, 200], [135, 34.02, 300]] });
    expect(s.present.elevationGainM).toBeGreaterThan(150);
    const typed = run(s, { type: "climb", value: 50 }, { type: "line", points: [[135, 34, 100], [135, 34.01, 400]] });
    expect(typed.present.elevationGainM).toBe(50);
  });
  test("undo and redo restore the line and the places, and a new action clears redo", () => {
    let s = run(fresh(), { type: "line", points: [[135, 34], [135, 34.01]] }, { type: "addPlace", key: "a", lat: 34, lng: 135 });
    expect(s.present.places).toHaveLength(1);
    s = run(s, { type: "undo" });
    expect(s.present.places).toHaveLength(0);
    expect(s.present.line).toHaveLength(2);
    s = run(s, { type: "undo" });
    expect(s.present.line).toHaveLength(0);
    s = run(s, { type: "redo" });
    expect(s.present.line).toHaveLength(2);
    s = run(s, { type: "addPlace", key: "b", lat: 34, lng: 135 });
    expect(s.future).toHaveLength(0);
    expect(run(fresh(), { type: "undo" }).present).toEqual(emptyDraft());
  });
  test("elevations from the map tiles fill in without an undo step, and are dropped if the line has moved on", () => {
    let s = run(fresh(), { type: "line", points: [[135, 34], [135, 34.01], [135, 34.02]] });
    const before = s.past.length;
    s = run(s, { type: "elevations", points: [[135, 34, 100], [135, 34.01, 200], [135, 34.02, 300]] });
    expect(s.past).toHaveLength(before);
    expect(s.present.line.map((p) => p[2])).toEqual([100, 200, 300]);
    expect(s.present.elevationGainM).toBeGreaterThan(150);
    const moved = run(s, { type: "line", points: [[135, 34], [135, 34.5]] });
    expect(run(moved, { type: "elevations", points: [[135, 34, 1], [135, 34.01, 2], [135, 34.02, 3]] })).toBe(moved);
  });
  test("typing is not an undo step", () => {
    const s = run(fresh(), { type: "text", field: "nameJa", value: "甲山" });
    expect(s.past).toHaveLength(0);
  });
  test("history is capped at 100 steps", () => {
    let s = fresh();
    for (let i = 0; i < 150; i++) s = run(s, { type: "addPlace", key: `k${i}`, lat: 34, lng: 135 });
    expect(s.past).toHaveLength(100);
  });
});

describe("places", () => {
  test("moving a place cancels the check on its position; moving it through the panel too", () => {
    let s = run(fresh(), { type: "addPlace", key: "a", lat: 34, lng: 135 });
    s = run(s, { type: "place", key: "a", patch: { positionVerified: true, positionSource: "公式" } });
    expect(s.present.places[0]!.positionVerified).toBe(true);
    s = run(s, { type: "movePlace", key: "a", lat: 34.001, lng: 135 });
    expect(s.present.places[0]!.positionVerified).toBe(false);
    s = run(s, { type: "place", key: "a", patch: { positionVerified: true } }, { type: "place", key: "a", patch: { lat: 34.5 } });
    expect(s.present.places[0]!.positionVerified).toBe(false);
  });
  test("reorder needs exactly the same places", () => {
    let s = run(fresh(), { type: "addPlace", key: "a", lat: 1, lng: 1 }, { type: "addPlace", key: "b", lat: 1, lng: 1 });
    s = run(s, { type: "reorderPlaces", keys: ["b", "a"] });
    expect(s.present.places.map((p) => p.key)).toEqual(["b", "a"]);
    const same = run(s, { type: "reorderPlaces", keys: ["b"] });
    expect(same).toBe(s);
  });
  test("the next default name counts the places", () => {
    const s = run(fresh(), { type: "addPlace", key: "a", lat: 1, lng: 1 }, { type: "addPlace", key: "b", lat: 1, lng: 1 });
    expect(s.present.places.map((p) => p.nameJa)).toEqual(["経由地1", "経由地2"]);
  });
  test("a new waypoint's stamp switch follows its kind: on for a temple or 'other', off for a toilet", () => {
    const s = run(fresh(), { type: "addPlace", key: "a", lat: 1, lng: 1 }, { type: "addPlace", key: "b", lat: 1, lng: 1, kind: "toilet" }, { type: "addPlace", key: "c", lat: 1, lng: 1, kind: "temple" });
    expect(s.present.places.map((p) => [p.kind, p.stampable])).toEqual([["other", true], ["toilet", false], ["temple", true]]);
    expect(s.present.places[1]!.nameJa).toBe("");
  });
});

describe("publish blockers", () => {
  const p = (over = {}) => ({ ...placeFromServer(serverSpot("s1")), ...over });
  test("in the order the API checks them", () => {
    expect(publishBlockers(p())).toEqual(["no_coordinates", "permission_required"]);
    expect(publishBlockers(p({ lat: 34, lng: 135 }))).toEqual(["position_not_verified", "permission_required"]);
    expect(publishBlockers(p({ lat: 34, lng: 135, positionVerified: true }))).toEqual(["position_not_verified", "permission_required"]); // no source named
    expect(publishBlockers(p({ lat: 34, lng: 135, positionVerified: true, positionSource: "公式", permissionConfirmed: true }))).toEqual([]);
  });
  test("an unsaved place, or one with unsaved changes, must be saved first", () => {
    expect(publishBlockers(p({ id: null }))).toContain("unsaved");
    expect(publishBlockers(p({ lat: 34, lng: 135, positionVerified: true, positionSource: "公式", permissionConfirmed: true }), true)).toEqual(["unsaved"]);
  });
});

describe("dirty and loading", () => {
  test("a freshly loaded draft is clean, an edit makes it dirty", () => {
    const d = draftFromServer(serverRoute(), [serverSpot("s1")]);
    expect(isDirty(d, d)).toBe(false);
    expect(isDirty(draftReducer(initialState(d), { type: "text", field: "nameEn", value: "x" }).present, d)).toBe(true);
  });
  test("a saved distance that is not the line's length counts as typed by hand", () => {
    const line = { type: "LineString" as const, coordinates: [[135, 34], [135, 34.01]] as [number, number][] };
    expect(draftFromServer(serverRoute({ geometry: line, distanceKm: 1.11 }), []).distanceManual).toBe(false);
    expect(draftFromServer(serverRoute({ geometry: line, distanceKm: 9.3 }), []).distanceManual).toBe(true);
    expect(draftFromServer(serverRoute({ distanceKm: 9.3 }), []).distanceManual).toBe(true);
  });
});

describe("preview", () => {
  test("shows drafts (an admin is looking) with their position unverified, and falls back to Japanese", () => {
    let s = run(fresh(), { type: "text", field: "nameJa", value: "甲山" }, { type: "line", points: [[135, 34], [135.1, 34.05]] });
    s = run(s, { type: "addPlace", key: "a", lat: 34.01, lng: 135.01 });
    const v = previewRoute(s.present, 2);
    expect(v).toMatchObject({ nameJa: "甲山", nameEn: null, order: 2, status: "soon", spotCount: 1 });
    expect(v.spots[0]!.position).toEqual({ lat: 34.01, lng: 135.01, verified: false });
    expect(v.line).toHaveLength(2);
    expect(v.area).not.toBeNull();
    expect(v.sketch).not.toBeNull();
    expect(previewRoute(emptyDraft(), 1).line).toBeNull();
  });
});

describe("save plan", () => {
  const savedDraft = () =>
    draftFromServer(serverRoute({ geometry: { type: "LineString", coordinates: [[135, 34], [135, 34.01]] }, distanceKm: 1.11 }), [serverSpot("s1"), serverSpot("s2", { nameJa: "二つ目" })]);

  test("nothing changed: nothing to send", () => {
    expect(planSave(savedDraft(), savedDraft())).toEqual([]);
  });
  test("a new route creates the route, then its places, and no separate order step", () => {
    let s = run(fresh(), { type: "text", field: "nameJa", value: "新しいルート" }, { type: "addPlace", key: "a", lat: 34, lng: 135 }, { type: "addPlace", key: "b", lat: 34.1, lng: 135 });
    const steps = planSave(s.present, null);
    expect(steps.map((x) => x.op)).toEqual(["createRoute", "createSpot", "createSpot"]);
    s = run(s, { type: "reorderPlaces", keys: ["b", "a"] });
    // New places are created in the draft's own order, so the server ends up in that order without an extra step.
    const reordered = planSave(s.present, null);
    expect(reordered.map((x) => x.op)).toEqual(["createRoute", "createSpot", "createSpot"]);
    expect(reordered.filter((x) => x.op === "createSpot").map((x) => (x as { key: string }).key)).toEqual(["b", "a"]);
  });
  test("only the changed fields go; the line never goes without its check", () => {
    const saved = savedDraft();
    const edited = run(initialState(saved), { type: "text", field: "nameEn", value: "Koyama" }).present;
    expect(planSave(edited, saved)).toEqual([{ op: "updateRoute", body: { nameEn: "Koyama" } }]);
    const redrawn = run(initialState(saved), { type: "line", points: [[135, 34], [135, 34.02]] }).present;
    const step = planSave(redrawn, saved)[0]!;
    expect(step.op).toBe("updateRoute");
    expect((step as { body: object }).body).toMatchObject({ lineVerified: false, lineSource: null, distanceKm: 2.22 });
  });
  test("a moved place sends both numbers and says what its check is; a renamed one sends only the name", () => {
    const saved = savedDraft();
    const moved = run(initialState(saved), { type: "movePlace", key: "s1", lat: 34.2, lng: 135.3 }).present;
    expect(planSave(moved, saved)).toEqual([{ op: "updateSpot", key: "s1", id: "s1", body: { lat: 34.2, lng: 135.3, positionVerified: false, positionSource: null } }]);
    const renamed = run(initialState(saved), { type: "place", key: "s2", patch: { nameJa: "改名" } }).present;
    expect(planSave(renamed, saved)).toEqual([{ op: "updateSpot", key: "s2", id: "s2", body: { nameJa: "改名" } }]);
  });
  test("editing a published place turns it back into a draft; a draft stays one", () => {
    const saved = { ...savedDraft(), places: savedDraft().places.map((p, i) => ({ ...p, published: i === 0 })) };
    const [first, second] = saved.places.map((p) => p.key);
    expect(run(initialState(saved), { type: "place", key: first!, patch: { nameJa: "改名" } }).present.places[0]!.published).toBe(false);
    expect(run(initialState(saved), { type: "movePlace", key: first!, lat: 34.2, lng: 135.3 }).present.places[0]!.published).toBe(false);
    // the publish switch itself and other places are not edits
    expect(run(initialState(saved), { type: "place", key: first!, patch: { published: true } }).present.places[0]!.published).toBe(true);
    expect(run(initialState(saved), { type: "place", key: second!, patch: { nameJa: "改名" } }).present.places[0]!.published).toBe(true);
  });
  test("deleted places go first; reordering is one step at the end", () => {
    const saved = savedDraft();
    const removed = run(initialState(saved), { type: "removePlace", key: "s1" }).present;
    expect(planSave(removed, saved)).toEqual([{ op: "deleteSpot", key: "s1", id: "s1" }]);
    const swapped = run(initialState(saved), { type: "reorderPlaces", keys: ["s2", "s1"] }).present;
    expect(planSave(swapped, saved)).toEqual([{ op: "orderSpots", keys: ["s2", "s1"] }]);
  });
  test("empty text is sent as null, never as an empty string", () => {
    const b = routeBody({ ...emptyDraft(), nameJa: " 甲山 " });
    expect(b).toMatchObject({ nameJa: "甲山", nameEn: null, descriptionJa: null, videoUrl: null, geometry: null });
    expect(placeBody(placeFromServer(serverSpot("s1")))).toMatchObject({ nameEn: null, positionSource: null });
  });
});

describe("unsaved places", () => {
  test("a place is unsaved when it is new or differs from its saved copy", () => {
    const saved = placeFromServer(serverSpot("s1"));
    expect(placeChanged(saved, saved)).toBe(false);
    expect(placeChanged({ ...saved, nameJa: "改名" }, saved)).toBe(true);
    expect(placeChanged({ ...saved, id: null }, saved)).toBe(true);
    expect(placeChanged(saved, undefined)).toBe(true);
    // a change in the published flag alone comes from the server, not from typing: not an unsaved edit
    expect(placeChanged({ ...saved, published: true }, saved)).toBe(false);
  });
});

describe("checks before saving", () => {
  test("a blank route or place name, and a video link that is not YouTube or Vimeo", () => {
    let s = run(fresh(), { type: "addPlace", key: "a", lat: 1, lng: 1 }, { type: "place", key: "a", patch: { nameJa: "  " } });
    expect(draftProblems(s.present)).toEqual([{ kind: "route_name" }, { kind: "place_name", key: "a" }]);
    s = run(s, { type: "text", field: "videoUrl", value: "https://example.com/x" });
    expect(draftProblems(s.present).map((p) => p.kind)).toContain("video_link");
  });
  test("a position with only one of its two numbers is a problem the person must fix", () => {
    let s = run(fresh(), { type: "text", field: "nameJa", value: "甲山" }, { type: "addPlace", key: "a", lat: 34, lng: 135 });
    s = run(s, { type: "place", key: "a", patch: { lng: null } });
    expect(draftProblems(s.present)).toEqual([{ kind: "place_position", key: "a" }]);
  });
  test("video links", () => {
    expect(videoLinkLooksValid("")).toBe(true);
    expect(videoLinkLooksValid("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(videoLinkLooksValid("http://youtu.be/dQw4w9WgXcQ")).toBe(false);
    expect(videoLinkLooksValid("not a url")).toBe(false);
  });
});

describe("the places table", () => {
  test("each new row is an unnamed waypoint with the stamp switch on and no position (the name is required before saving); a new route saves the route, then every row", () => {
    const s = run(fresh(), { type: "text", field: "nameJa", value: "新しいルート" }, { type: "addRow", key: "a" }, { type: "addRow", key: "b" });
    expect(s.present.places.map((p) => [p.key, p.kind, p.stampable, p.nameJa, p.lat, p.lng])).toEqual([
      ["a", "other", true, "", null, null],
      ["b", "other", true, "", null, null],
    ]);
    expect(draftProblems(s.present).filter((p) => p.kind === "place_name")).toHaveLength(2);
    const typed = run(s, { type: "place", key: "a", patch: { nameJa: "一" } }, { type: "place", key: "b", patch: { nameJa: "虎島の経塚", lat: 34.27, lng: 135.0 } });
    expect(planSave(typed.present, null).map((step) => step.op)).toEqual(["createRoute", "createSpot", "createSpot"]);
    expect(typed.present.places[1]).toMatchObject({ nameJa: "虎島の経塚", lat: 34.27, positionVerified: false });
  });
});
