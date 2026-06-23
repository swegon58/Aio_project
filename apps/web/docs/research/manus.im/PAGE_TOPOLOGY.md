# manus.im — Page Topology

## Scope
Homepage (`/`) + 4 Features sub-pages (`/features/webapp`, `/features/manus-browser-operator`, `/features/wide-research`, `/features/mail`). No footer exists site-wide on these pages (`document.querySelector('footer')` = null).

## Global Layout (all pages)
- SimpleBar custom scroll container — actual scroll happens inside `.simplebar-content-wrapper`, not `document.body`.
- `<header>` — `w-full h-[56px] relative z-20 max-md:hidden` (desktop only, `max-md:hidden`). Mobile uses a separate header variant (logo + Sign in/up + hamburger).
- Background gradient wrapper: `bg-[linear-gradient(180deg,#F3F3F3_0%,#EDEDED_100%)]`

## Homepage Sections (top → bottom, desktop 1920px, content height 1874px)

1. **Header** (~56px, sticky/relative z-20)
   - Inner: `mx-auto max-w-[1080px] h-full py-3 px-6 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center`
   - Left: Logo (SVG icon + "manus" wordmark), links to `/?index=1`
   - Center: nav links — Features, Solutions, Resources, Events (`https://events.manus.im`), Business (`/team`), Pricing (`/pricing`)
   - Right: Sign in (dark pill, bg `--Button-black`), Sign up (light pill, transparent bg)

2. **Meta acquisition banner** (full width, ~44px height)
   - bg `var(--fill-tsp-white-light)` (rgba(55,53,47,0.04))
   - Single centered link `<a href="/team">`: text "Manus is now part of Meta — bringing AI to businesses worldwide" + trailing arrow icon, hover:opacity-80

3. **Hero** (vertically centered in remaining viewport height)
   - H1: "What can I do for you?" — LibreBaskerville 36px/54px, weight 400, color `#34322d`, margin `0 0 34px`
   - Input box: white rounded card, contenteditable (TipTap/ProseMirror) with placeholder "Assign a task or ask anything"
     - Left button: "+" icon, 32x32 circular, border `0.87px solid rgba(0,0,0,0.06)`
     - Right button: submit (up-arrow), 32x32 circular, `bg-[var(--Button-black)]`, disabled state `opacity-50`/bg `rgba(55,53,47,0.08)`
   - 5 pill buttons below input, `flex gap`, each `h-10 px-[14px] py-[7px] rounded-full border border-[var(--border-main)] flex items-center gap-2 hover:bg-[var(--fill-tsp-white-light)]`:
     - "Create slides" (icon + label)
     - "Build website" (icon + label)
     - "Develop desktop apps" (icon + label)
     - "Design" (icon + label)
     - "More" (no icon, opens dialog — `aria-haspopup="dialog"`)

## Interaction Model
- Header/banner/hero: **static**, no scroll-driven changes observed (no scroll-snap, no IntersectionObserver triggers detected in reconnaissance).
- Pills + Sign in/up: **hover-driven** — opacity/background change on hover (`hover:opacity-80`, `hover:bg-[var(--fill-tsp-white-light)]`).
- "More" pill: **click-driven** — opens a dialog (`aria-haspopup="dialog"`), content not yet captured (out of immediate scope unless visually prominent).
- Submit button: **state-driven** — disabled (opacity-50, gray bg) when input empty; becomes active (full black bg) when input has content.

## Features Sub-pages (NOT YET extracted)
- `/features/webapp` — IN PROGRESS, see below
- `/features/manus-browser-operator`
- `/features/wide-research`
- `/features/mail`

Each shares the global header + likely a hero/feature-showcase layout. To be extracted individually using the same 1920×scrollHeight-resize screenshot technique, then specced + dispatched.

---

# /features/webapp

Update: this page DOES have a footer (`<section class="bg-[var(--Button-black)] w-full">`, 7-column link grid + social
icons + language selector + copyright). Already extracted and built as the shared `src/components/Footer.tsx`
(wired into homepage this session). Earlier note above ("no footer site-wide") may be stale or homepage-specific —
re-verify when homepage is revisited.

## Layout
1440px viewport, full page height ~8800px, single-column scroll, shared Header (sticky) above, shared Footer below.

## Sections (top to bottom)

| # | Working name | top (px) | height (px) | Interaction model |
|---|---|---|---|---|
| 0 | Hero | 100 | 676 | static |
| 1 | Integrations strip | 776 | 288 | static (verify: marquee vs static grid) |
| 2 | "Why Manus?" | 1064 | 790 | static |
| 3 | "Everything you need..." | 1854 | 1916 | static, likely multi-card grid |
| 4 | "Your freedom & control" | 3770 | 832 | static |
| 5 | "Go from idea to live website..." | 4601 | 755 | static |
| 6 | "Real life websites Manus built" | 5356 | 1120 | click-driven carousel |
| 7 | "Frequently asked questions" | 6476 | 1021 | click-driven accordion |
| 8 | "Ready to build something amazing?" (CTA) | 7497 | 616 | static |
| F | Footer | ~8113 | ~687 | static — built |

## Status
- [x] Footer extracted + built (shared component, wired into homepage)
- [ ] Per-section screenshots
- [ ] Per-section computed-style extraction
- [ ] Asset discovery (images)
- [ ] Interaction sweep (sections 1, 6, 7)
- [ ] Section components built
- [ ] Page assembled at `src/app/features/webapp/page.tsx`
