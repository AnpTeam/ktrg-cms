# Plan: a real navigation mode for /map

Status: **proposed, nothing built.** Written 2026-11-04 after the user's answers (below). Plan only.

## What the user said (2026-11-04)

1. **The problem:** the app "just doesn't bring you to the navigation mode like other navigation apps would do."
2. **Navigation is core to the app**, not a light helper.
3. **Voice: off by default**, but wanted; keep the whole thing lightweight and give the most to the user.
4. **Offline:** use the course line we already hold; if the visitor is **not on the path yet**, ask them to connect to find the way to the path.
5. Q5 (how far the 19 courses' lines can be trusted for off-route warnings) is **open, the user will research**. Nothing below depends on it except the warning distance in N4, which stays a setting until then.

## What happens today (from the code)

- 「この区間をナビする」 is a button deep in a course's panel in the bottom sheet (`NavigationStart`, `MapScreen.tsx`). Pressing it starts a session; the screen stays the **browse map** with the sheet, and a small toast bar (`NavigationToast`, `NavigationHud.tsx`) carries the turn sign, distance and stop name.
- The map does follow the visitor and take the heading while a session runs (`MapScreenCanvas.tsx`, `user`, `towardsDeg`), but nothing changes the screen's character: no full-screen mode, no big instruction, no course progress, no way to leave except the toast's 終了.
- Core logic is good and tested (pure functions): nearest unstamped open stop, on-line guidance, off-line walking path from OpenRouteService (signed-in only, at most every 30 s), straight fallback, turn announcements, poor-accuracy fixes dropped, position paused when hidden.

So the engine exists; the **experience around it** is what is missing.

## Target experience

Pressing **ナビをはじめる** (a large, always-visible button on the course card and in the sheet header, not buried) switches /map into **navigation mode**:

- **Full-screen map** that follows the visitor, heading-up (turns with the phone's heading, with a visible north button), the sheet gone.
- **Top banner:** the next instruction big (turn sign, 「150m先 右折」), the stop name under it. Calm, high contrast, big type (older users).
- **Bottom strip:** course progress ("3 / 9 stops"), distance and walking time to the next stop and left on the course, a small elevation profile of what is ahead when the course has elevation. One tap opens the stop list to **choose another target** or skip one on purpose.
- **Stamp moment:** within the stop's radius the strip becomes a big 「スタンプを押す」 (existing `StampHere` with the progress popup), then moves on to the next stop by itself.
- **Off-route:** after the visitor stays more than N m from the line (N a setting, default 60 m until the user's research on line accuracy is in), a banner 「道からはずれています」 with an arrow back to the nearest point of the line and the distance. No spam: once per departure, again only after being back on the line.
- **Exit:** a clear 「ナビを終える」 with a confirm, never a tiny control. Closing the tab or reloading ends the session (nothing is kept, as today).
- **Wake lock** behind a visible toggle (default on in navigation mode, because the screen is the guidance; off saves battery). Position pauses when the screen is hidden, with the last position and its age shown (existing behaviour).
- **Voice (off by default)** via the browser's `speechSynthesis`: one short phrase at 200 m and at the turn, in the app language, and for off-route and arrival. A visible toggle in the banner. No audio files, no dependency. Vibration for turn and arrival where the browser has it (iOS Safari does not; say so in the toggle's help text).
- **Lightweight:** no new libraries. Voice is the platform's own; the map, the follow code and the engine are reused. The mode is a state of the existing map page, not a new route, so nothing extra loads for visitors who only browse.

## Offline (decision 4)

- With the Phase B pack saved, the **course line, stops and tiles are local**, so line guidance, off-route warning, progress and the stamp queue all work with no signal.
- **Joining the line:** guidance along the line needs the visitor to be near it. If they start **far from the line** (beyond the join distance, default 150 m) and have no walking path, show: 「まだ道の上にいません。電波のある場所で、道までの経路を調べてください。」 with a 「経路を調べる」 button that asks OpenRouteService while online. Offline and far: a straight arrow and distance to the nearest point of the line, clearly labelled 直線 (as the crow flies), no pretending.
- Signed-in only for ORS today (account-bound rate limit). Keep it; a signed-out visitor offline far from the line gets the straight arrow. Whether guests may ask for a path is a separate decision for later (rate-limit risk), not part of this plan.

## Slices

| # | Slice | Verified by |
| --- | --- | --- |
| N1 | **Navigation mode shell:** one prominent start button; full-screen follow map, heading-up; top banner and bottom strip (no new data yet); clear exit; remove the toast on /map while in the mode | component state tests; phone |
| N2 | **Progress and ETA:** per-course progress, distance and time left, next-stop numbers from the model (pure functions, walking pace from the course's own `fromPrev` minutes) | unit tests |
| N3 | **Choose another target / skip:** stop list from the strip; `targetOverride` in the controller; "back to automatic" | controller tests |
| N4 | **Off-route warning:** departure/return state with hysteresis, return arrow to the nearest line point, setting for the distance | pure-function tests with synthetic walks |
| N5 | **Voice and haptics:** `speechSynthesis` phrases (ja and en), throttled, off by default, toggle persisted per device (localStorage is allowed for a per-viewer convenience) | unit tests for phrase and throttle logic; phone |
| N6 | **Elevation strip** where a course has elevation | unit tests; phone |
| N7 | **Offline join flow** (after Phase B packs exist): far-from-line message, 経路を調べる, straight arrow fallback | tests; airplane-mode on a phone |

Order: N1 first (it answers the user's main complaint), then N2, N3, N4, N5; N6 and N7 later. N7 needs Phase B (B4/B5) first.

## Open questions

- **Q5 (the user is researching):** how accurate are the 19 courses' lines? It sets the default for the off-route distance (60 m is a placeholder) and whether an off-route warning is trustworthy on a given course. Until answered, N4 ships with a conservative default and a per-course on/off in the admin is the fallback.
- Walking pace for the time left: use each course's recorded minutes, or a simple pace (e.g. 3 km/h on the flat plus elevation gain)? Proposal: the recorded minutes where they exist, else the simple pace.
- Should the mode be reachable from the Home dashboard's 「続きを歩きませんか？」 card in one tap (straight into navigation for that course)? Proposal: yes.
- Heading-up or north-up as the default? Proposal: heading-up with a north button, remembered per device.
