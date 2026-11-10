# Design language

How the visitor side of the site should look, move and read. It sits on top of the rules in `CLAUDE.md`
(contrast, 48 px targets, tokens, no web fonts), which still win. Written 2026-11-10 after comparing our site with
NIS (katsuragi-shugen.vercel.app) and Gose City's gosenone.com.

## Why this exists

A site looks "made by a template" when every part could belong to any place: system font, gradient pill buttons,
rounded cards with arrow icons, a generated painting behind a centred headline. Swap the text and it is a trail in any
country. gosenone feels made by hand for the opposite reason: a painting of the real town, vertical Japanese headlines,
one thought per screen, and words that arrive as you reach them.

**The rule behind everything below: every visual choice must come from Katsuragi itself** — its line, its chapters,
its seals, its photographs, its writing — or be plain enough to disappear.

## Two registers

| Register | Pages | Feel |
|---|---|---|
| **読みもの (reading)** | Landing for new visitors, 葛城修験とは, the top of each course page | Editorial. Full-width real pictures, vertical Japanese headlines, the ridge line as a thread, words revealed on scroll, very few boxes |
| **道具 (tools)** | Map, stamping, my stamps, rallies, settings, login, admin | The app as it is, calmer. Plain and fast; no decoration, no reveal motion |

A page belongs to one register. The tools are used on the trail with one hand and weak signal: nothing from the
reading register (motion, big pictures, vertical text) goes there.

## Motifs: what is ours

1. **The ridge line.** The trail runs about 112 km from the sea at Tomogashima to Kongō. We hold its real geometry. On
   reading pages it is the thread that ties sections together: drawn from the real route, never a decorative squiggle.
   One thin stroke in `line` or `brand`, about 1.5 px.
2. **Twenty-eight chapters.** Each sutra mound carries a chapter of the Lotus Sutra (序品 is the first). Long reading
   pages are split into chapters, not "features"; a chapter mark is its number and chapter name, set like a sutra book.
3. **The seal.** The shu (朱) stamp is the only vermilion on the site, and only for stamps. It is the reward; keep it
   rare so it stays special.
4. **Hand drawings.** Drawn by our own team (see the drawing brief below). They are the identity, the way gosenone's
   painting is theirs.
5. **Washi and 七宝.** The cream paper and the faint 七宝 pattern stay as the ground everything sits on.

## Typography

- **Headings:** Mincho (`--font-serif`), body: UD Gothic (`--font-sans`). System fonts only, as now.
- **Vertical headlines (縦書き)** on reading pages, Japanese only: `writing-mode: vertical-rl`, at least `text-3xl`,
  short (one or two lines of up to about 14 characters). Body text is always horizontal.
- **English is never vertical.** Our English pages set the same headline horizontally. A Japanese page put through a
  browser translator (Google Translate) must also fall back to horizontal: gosenone shows what happens otherwise —
  "The colorful Gosenone" turned on its side. Scope vertical styles to Japanese text and turn them off when the page
  has been machine translated (Google adds a `translated-ltr` class to `<html>`; check this when building).
- **Measure:** body text 35 to 40 Japanese characters a line on reading pages, `leading-8` or more.
- **Hierarchy by size and space, not by boxes.** A section title over open space, not a title inside a card.

## Colour

Use the existing tokens in `globals.css`; nothing new is needed. On reading pages, colour comes mostly from the
pictures; the page stays paper, ink and one brand-red mark per screen. Body text keeps 7:1 — gosenone's pale grey
paragraphs are exactly what not to copy.

## Layout and pace (reading register)

- **One idea per screen** on a phone: a picture, a headline, two or three short lines.
- **Space is the separator.** Between sections, large vertical space (about one screen-third), not borders or cards.
- **Pictures full width** on phones; on wide screens they may break the column on one side.
- **At most one button per section**, at the end of the section, and one main button at the end of the page.

## Motion

- **Reading register only.** One reveal per section: the headline and its lines fade up a short distance (about 12 px,
  600 ms, `--ease-enter`), lines 80 ms apart. The ridge line may draw as it scrolls into view.
- **Never hide content waiting for motion.** The page is complete and readable with no JavaScript, with
  `prefers-reduced-motion: reduce`, and before scripts load. The reveal is added on top: elements are visible by
  default and only start hidden once a script has confirmed motion is allowed.
- **No loading screens, no scroll hijacking, no parallax, nothing that moves by itself without a pause button.**
- **No library.** An IntersectionObserver of about 20 lines does it; GSAP or similar would be a new dependency.
- **Tools register:** only the feedback that already exists (menus, toasts, the stamp press).

## Pictures

- **Real photographs** (the council's, credited, per the source record) and **our own drawings**. Nothing generated by
  AI, ever: a generated painting is the clearest sign of a template site.
- Every picture has a caption or credit line in text, and `alt` that says what it shows.
- Sizes are declared (aspect ratio) so nothing jumps while loading; below the first screen they load lazily.

## Do and don't

Numbered so we can discuss them by number.

**Do**

- D1. Start from something real in Katsuragi before choosing a shape, a colour or a motion.
- D2. Use the ridge line, the chapters and the seal as the site's marks.
- D3. Let space separate sections on reading pages.
- D4. Set short Japanese headlines vertically on reading pages; horizontal everywhere else.
- D5. Write headlines as a person would say them about this place, not as slogans.
- D6. Give every reading section one picture or drawing, captioned.
- D7. Keep the tools register plain, fast and the same on every page.
- D8. Check every page with large text, a phone on its side, dark mode and reduced motion.

**Don't**

- N1. No AI-generated images or illustrations.
- N2. No gradient blobs, glows, glass blur or "aurora" backgrounds.
- N3. No card inside a card; no grid of icon-plus-arrow link cards.
- N4. No pill badges for things that are not a status (for example "日本遺産・大阪・和歌山・奈良").
- N5. No pale grey body text; body text keeps 7:1.
- N6. No content that only appears after an animation, and no loading screen.
- N7. No vertical English, and no vertical text in the tools register.
- N8. No carousel that moves by itself without a pause button.
- N9. No more than one red button on a screen.
- N10. No emoji as icons; one icon set, one stroke weight.

## Drawing brief

Drawings will be made by our own team. To make them usable in light and dark mode and at every size:

- **Line drawings in one colour** on a transparent background, so the site can tint them (ink on paper, light on
  dark). Colour paintings are welcome for the hero, with a version that works on the dark page.
- **Hand them over as SVG** (best for line work) or **PNG at 2400 px wide** for paintings. Keep the layered source.
- **No paper texture in the drawing**: the page adds the washi.
- **First drawings to make, in order:**
  1. A wide view of the ridge from the sea to Kongō, for the landing (wide, about 3 : 1).
  2. Tomogashima and the sea, the start of the walk.
  3. A sutra mound (経塚), for chapter marks; small and simple enough to work at 48 px.
  4. A walker on the ridge, small, for empty states.
- Each drawing gets a line in the source record with who drew it and when.

## Phases

0. This document (agreed do and don't list).
1. Landing for new visitors as a story: the hero with a vertical title, "from the sea to the mountains" with the real
   line drawn on scroll, the chapters, how stamps work in three lines, one button. English set horizontally.
2. Home for signed-in visitors: a sentence and the next place first, a strip of seals; fewer tiles and boxes.
3. Course page header: a vertical title on the cover, with the course's own piece of the line as its mark.
4. Tools register: remove card-in-card nesting and extra badges; one panel style.

## Open

- How each English reading page should feel without vertical headlines (likely: a large horizontal Mincho title with
  the ridge line under it).
- Whether the council's own map art may be used beside our drawings.
