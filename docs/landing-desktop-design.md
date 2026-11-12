# Landing on a desktop: a split-screen journey

Status: **approved 2026-11-12, plan in `docs/landing-desktop-plan.md`, nothing built.** Written 2026-11-12 from the user's choices that day (see "Decided"). It extends
`docs/landing-story-design.md` (the phone journey) and `docs/landing-journey-design.md` (the sticky scene). Phones and tablets
keep what they have; this is only what a wide, tall screen gets.

## Why

The phone journey runs unchanged on a desktop: a pinned stage with the words in a narrow middle column, large empty dark areas,
and the ridge as a thin line along the bottom (seen at 1440 x 900, 2026-11-12). The chapters after it are phone stacks centred
in a wide page. A desktop visitor has room for words and a picture side by side, so the page should use it.

## Decided (the user, 2026-11-12)

1. **Concept: split screen.** Words on the left, one large picture on the right that changes as you scroll (the sea photo, then the
   ridge drawing, then the seals).
2. **Scope: the intro scene and the chapters after it** (map, video, courses, start), so the whole home page is laid out for a
   wide screen.
3. Phones keep their journey (and a phone on its side keeps the stacked page, #452).

## Where it applies

A new gate, **`desk`: width at least 1024 px and height at least 38rem**. Not the `wide:` variant: `wide:` also matches a phone on
its side (768 px and up, 600 px or less tall), which must keep the stacked page. Tablets in portrait (768 to 1023 px) keep the
phone scene. The gate lives in one place (a CSS custom variant `desk` in `globals.css` and the same query in `JourneyScene`, as
`lib/screen.ts` does for `wide`), and `gsap.matchMedia` swaps between layouts when the window is resized, no reload.

## The scene (pinned stage, one screen tall, about 300 svh of scroll instead of 250)

Same three beats and the same words; the DOM does not change much, the layout does.

- **Beat 0, the sea:** unchanged (full-bleed photos, the line over them, the scroll cue).
- **Beats 1 and 2:** the stage becomes two columns.
  - **Left, about 5/12:** the beat's chapter (headline, words, link or button, facts). Vertical headline in Japanese as today.
    It stays centred in the column and fades between beats as now.
  - **Right, about 7/12: the picture panel**, a nearly square-cornered panel that fills the stage height with a margin. It holds,
    from back to front: a course photo (see "Decided in review") under a ground-coloured gradient so it is only a hint; the
    wave band; the ridge drawn large across the panel (drawn from the first scroll, done by half, as on the phone); the seals
    dropping onto it in the last beat. The staff and the sutra scroll stay with their chapters in the left column.
    The panel's ground follows the beat (night for the story, surface for the stamp rally) with the existing colour transition.
  - **Step marker** on the left edge of the stage: three numbered steps (01 sea, 02 ridge, 03 mounds; Japanese 海, 稜線, 経塚) with the
    active one filled. It answers "is the page really scrolling" on a desktop, and doubles as the keyboard-visible progress.
- **Photo credit** for the panel's photo is shown small at the panel's corner (same rule as the hero).
- **Fit guard (both layouts):** if any beat is taller than the stage (a long editor text, a big text size setting), the scene
  does not start and the stacked page stays. Today a long text would be cut off.

## The chapters after the scene (desk only)

- **Map:** the map is taller (about 70 svh) and full width; the heading and one line sit in a card over its left side.
- **Video:** two columns, words on the left, the video (16:9) on the right.
- **Courses:** a grid of two columns (three at 1440 px and up) instead of one stack; the cards still rise one by one, by row.
- **Start (さあ、はじめましょう):** headline across the page (not vertical), the three buttons in a row, the mountains full width
  along the bottom, the seam fade from the chapter above stays.
- Notices, blog and the closing links already use two columns and are not touched.

## Motion and accessibility

- Reduced motion, calm, no script or a failed GSAP load: the stacked page, every word and the whole ridge (as on the phone).
- All the words and buttons stay in the DOM in reading order; the skip link stays first.
- Drifting uses transform and clip only (docs/design-language.md, Motion); words and photos never drift.
- Text keeps 7:1 on each ground; the photo under the panel is covered by a gradient so it never sits under text.
- All new words exist in Japanese and English (the step marker labels).

## Out of scope

Panning the trail sideways across the screen (considered, not chosen); a new map; any change to the phone or tablet scene.

## Testing

- Unit: the `desk` gate query is one constant used by both the CSS variant and `JourneyScene`; the fit guard decision.
- Source tests as for the phone (the step marker words in both languages, no hard-coded colours in new drawings).
- Browser (Playwright) at 1440 x 900, 1280 x 720, 1024 x 768 and 1920 x 1080, Japanese and English, with reduced motion on and
  off; a resize from desktop to phone width and back swaps layouts without a reload.
- Not verifiable here: a real large monitor and a real trackpad or mouse wheel.

## Decided in review (the user, 2026-11-12)

1. **The panel's photos are course photos**, not banner photos: the first two published courses that have a photo (published first, in course order), the first behind the story beat and the second behind the stamp rally beat, crossfading. With no course photo yet, the first banner photo, else `public/home/top_slider_img01.jpg`. The photo credit of the course is shown at the panel's corner.
2. **Step marker words:** 海 / 稜線 / 経塚 and Sea / Ridge / Mounds.
3. **About 300 svh** of scroll on desktop.
