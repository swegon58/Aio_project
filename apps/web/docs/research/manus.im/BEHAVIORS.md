# manus.im — Behaviors (Homepage)

## Scroll
- SimpleBar custom scroll container (`.simplebar-content-wrapper`). No native body scroll.
- No scroll-snap, no IntersectionObserver-driven animations detected on homepage (content fits ~1874px at 1920 viewport, mostly hero is vertically centered with empty space above/below).
- Header has `max-md:hidden` — no scroll-triggered shrink/shadow observed on desktop.

## Hover
- Banner link ("Manus is now part of Meta...") → `hover:opacity-80 duration-300`
- 5 hero pills (Create slides / Build website / Develop desktop apps / Design / More) → `hover:bg-[var(--fill-tsp-white-light)]`
- Sign in / Sign up buttons → standard button hover (opacity shift, not yet measured precisely — low priority, default shadcn button hover acceptable)
- "+" attach button (input box) → `hover:bg-[var(--fill-tsp-white-light)]` (border circle)

## Click
- Logo → navigates to `/?index=1`
- Nav links (Features, Solutions, Resources, Events, Business, Pricing) → route links
- Banner → links to `/team`
- "More" pill → `aria-haspopup="dialog"`, opens a dialog (content not captured — low priority for clone, can stub as non-functional or simple modal)
- Submit (up-arrow) button → disabled (`opacity-50`, gray bg `rgba(55,53,47,0.08)`) when input empty; enabled (full black `--Button-black`) when input has text. Pure CSS state via `:disabled` — driven by input content via React state in original; clone can mirror with controlled input + disabled prop.

## Input
- Hero input is a TipTap/ProseMirror `contenteditable` rich text area with placeholder "Assign a task or ask anything". Clone can use a simple `contentEditable` div or textarea styled identically — rich text editing not required for visual clone.

## Responsive
- Desktop header (`max-md:hidden`) vs mobile header (logo + Sign in/up + hamburger `≡`) — confirmed via 390px screenshot.
- Mobile (390px): hero pills wrap into rows (row1: Create slides/Build website, row2: Develop desktop apps/Design, row3: More centered).
- Banner text wraps to 2 lines on mobile (`max-md:gap-[8px]`).

## Notes
- No carousels, parallax, dark mode toggle, or time-based animations found on homepage during this pass.
- Features sub-pages not yet swept — repeat scroll/click/hover sweep when extracting each.
