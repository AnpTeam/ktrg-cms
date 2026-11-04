# Plan: getting to the course by train or bus (navigation, far from the trail)

Status: **proposed, nothing built.** Written 2026-11-04 after the user's answers. Plan only.

## The problem

Navigation only knows how to walk. From far away it asks OpenRouteService for a **foot** path, so a visitor 20 km away is told to walk 20 km. It never mentions a station, although every route already holds hand-entered 「行き方」 entries (train, bus, ferry, car, walk) that the route page shows.

## What the user decided (2026-11-04)

- The visitor we care about **travels from far** (overseas, other prefectures) and needs the way to the trailhead.
- **Needed at launch** (not before end of 2026).
- **No ongoing cost.** So no paid transit API (Navitime, Google Directions), and no self-hosted router (a server to run).
- "Far" **depends on the course**; **5 km is the ideal** default.
- The access entries **already say** which end of the course each station serves (in their notes today; to be made a field, see Data).
- Offer **options**: our own walking route, or open the trip in Google Maps, Yahoo! maps and others.
- English station names are fine today.
- **The user enters the data** (station positions).

## What we will not build

A transit router of our own (timetables, transfers, live status). It is a product, needs data that changes by day and season, and every tier of it costs money to run. The hand-off buttons below give the visitor real timetables from services that maintain them.

## The experience

1. **Far mode.** When the visitor is farther than the course's *far distance* from the nearest point of the course (and from every stop) at the first fix, the navigation does **not** draw a foot path of 20 km. The banner and the strip show a card instead:
   「この区間は遠くにあります。電車やバスで向かいましょう」 followed by the course's access entries, each with its kind icon (train, bus, ferry), name, note and which end it serves.
2. **Options on each entry**, in this order (each is a plain link or button, the visitor chooses):
   - 「ここまでの行き方を調べる（Googleマップ）」 : `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=transit`.
   - 「Yahoo!マップで調べる」 and, if its link format is confirmed, 「乗換案内（Yahoo!）」 / Jorudan. **To check before building:** the exact URL format of each, and whether it takes coordinates or only station names.
   - 「この駅の時刻表」 : the entry's existing `url`.
   - 「歩く道を調べる（このアプリ）」 : our OpenRouteService walking route to the course, still offered, but now a **choice**, with the distance shown, and never started on its own.
3. **Once the visitor is within the far distance**, the card steps aside and the normal navigation (line, path, stop target) takes over. The off-route and target-choice rules are unchanged.
4. **Offline.** The card needs no network: the entries and positions are in the route data, and the Phase B pack carries them. The hand-off buttons obviously need signal, and say so.

## Data

The access entries live in `routes.access_points` (a `jsonb` column), so adding fields needs **no migration**, only the type and the API validation.

New optional fields on an `AccessPoint`:

| Field | Meaning |
| --- | --- |
| `lat`, `lng` | Where the station or stop is. **Never guessed**: a person enters it from a named source (the operator's page or the official site) and checks it on the map, like the mound positions. Hidden from visitors until checked. |
| `serves` | `"start"`, `"end"` or `"both"`: which end of the course it is for. Today this is only in the note text; it becomes a field so the card can sort and the hand-off can pick the nearer end. |
| `positionChecked` + `source` | Same idea as 位置を確認した: who looked it up and where. |

Without a checked position, an entry still shows its name, note and timetable link; only the map hand-off buttons are hidden for it.

Per-course *far distance*: a nullable number on the route (default 5000 m), set in the route editor. Another `jsonb`-free column would need a migration; to avoid one, it can sit in the existing route settings if there is a place for it (to be checked when building). If not, one small migration.

## Slices

| # | Slice | Verified by |
| --- | --- | --- |
| T1 | Data: `lat`, `lng`, `serves`, checked flag on access entries (type, API validation, admin editor with a map pick and the "checked" step); per-course far distance | unit and API tests; a check that unchecked positions never reach visitors |
| T2 | Far mode in the navigation controller: a pure `isFar(model, fix, farM)` and a new state; no OpenRouteService call while far | unit tests with synthetic fixes |
| T3 | The card and the options (links built by a pure function from coordinates), in the banner and the toast, ja and en | link-builder tests; screenshot; phone |
| T4 | Verify the hand-off URLs for Google, Yahoo and the others, on a phone with each app installed and not | the user, on a phone |
| T5 | Enter and check the positions for the 19 courses (about 40 entries) | the user, with the admin screen |

T1 to T3 are a few days of work and no running cost. **T5 is the real cost** (content, not code) and is what decides whether the buttons have anything to point at by launch.

## Risks and open questions

- **Privacy.** Opening Google or Yahoo sends the destination (a station, not the visitor's position) to them, and the visitor's own app adds their position there. We send nothing ourselves. The card should say the page opens in another service. Confirm this fits the privacy policy text.
- **URL formats change.** Hand-off links are not an API contract. They are built in one place and checked in T4; if one breaks, remove that button, nothing else depends on it.
- **Course far distance** needs a sensible value for each of the 19; 5 km is the default and the editor shows it.
- **Which stop is "the start"** when a visitor is far from everything: nearest point of the course, not the first stop. The card lists entries by `serves`, nearer end first.
- Not covered: bus/ferry timetables inside the app, taxis, parking details, multi-day trip planning.
