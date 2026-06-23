# Hero Component Spec

File: `src/components/Hero.tsx`

## Structure

```html
<section class="<centered column, max-w container>">
  <h1>What can I do for you?</h1>

  <div class="<input box wrapper>">
    <div contenteditable="true" data-placeholder="Assign a task or ask anything"></div>
    <div class="<bottom row of input box>">
      <button class="<plus button>"><PlusIcon /></button>
      <button class="<submit button, disabled by default>"><SubmitArrowIcon /></button>
    </div>
  </div>

  <div class="<pills row>">
    <div class="pill"><CreateSlidesIcon /> Create slides</div>
    <div class="pill"><BuildWebsiteIcon /> Build website</div>
    <div class="pill"><DevelopDesktopAppsIcon /> Develop desktop apps</div>
    <div class="pill"><DesignIcon /> Design</div>
    <div class="pill">More</div>
  </div>
</section>
```

## H1
- Text: "What can I do for you?"
- `font-family: var(--font-heading)` (LibreBaskerville), `font-weight: 400`
- `font-size: 36px`, `line-height: 54px`
- `color: #34322d` (`var(--text-primary)`)
- `margin: 0 0 34px`
- Tailwind: `font-heading font-normal text-[36px] leading-[54px] text-[var(--text-primary)] mb-[34px] text-center`

## Input box
- Width: `766.25px` (max-width container, full width on smaller screens — use `w-full max-w-[766px]`)
- Height: `~46px` min (auto-grows with `contenteditable`)
- `font-size: 15px, font-weight: 400, line-height: 24px, color: #34322d`, system sans font
- `padding: 0px 8px 0px 16px`
- Container: white/`var(--background-card)` bg, rounded corners (`rounded-[20px]` or similar — verify against screenshot), border `1px solid var(--border-main)`, subtle shadow
- `contenteditable="true"` div with placeholder text "Assign a task or ask anything" (use `data-placeholder` + CSS `:empty:before { content: attr(data-placeholder) }` styled with `text-[var(--text-tertiary)]`)
- Bottom row inside the box: flex row, `justify-between items-center`, padding around `8px 12px`

### Plus button (left)
- `PlusIcon` from `src/components/icons.tsx`
- Size: `32x32px` circular, `border: 0.87px solid rgba(0,0,0,0.06)`, `rounded-full`
- `display: flex, align-items: center, justify-content: center`
- Icon `18x18`, `fill: var(--icon-primary)`

### Submit button (right)
- `SubmitArrowIcon` from `src/components/icons.tsx`
- Size: `32x32px` circular, `rounded-full`
- Default/disabled state (no text entered): `background: rgba(55,53,47,0.08)` (`var(--fill-tsp-white-dark)`), icon color `var(--icon-disable)`, `opacity: 0.5`, `cursor: not-allowed`
- Active state (text entered): `background: var(--Button-black)` (`#1a1a19`), icon `currentColor` → white
- For this static clone, render the disabled state as default (matches initial page load)

## Pills row
- Container: `flex flex-wrap items-center justify-center gap-2` (or `gap-3` — check screenshot spacing), `mt-6` below input box
- Each pill: `<div role="button" class="h-10 px-[14px] py-[7px] rounded-full border border-[var(--border-main)] flex justify-center items-center gap-2 hover:bg-[var(--fill-tsp-white-light)] flex-shrink-0 cursor-pointer">`
- Pill label: `<span class="text-[var(--text-primary)] text-[14px] font-normal">{label}</span>`
- Icon: `18x18px`, `color: var(--icon-tertiary)` (pass as `className="text-[var(--icon-tertiary)]"` or `stroke`/`fill` prop depending on icon)

### Pills (in order)
1. **Create slides** — `<CreateSlidesIcon />` + "Create slides"
2. **Build website** — `<BuildWebsiteIcon />` + "Build website"
3. **Develop desktop apps** — `<DevelopDesktopAppsIcon />` + "Develop desktop apps"
4. **Design** — `<DesignIcon />` + "Design"
5. **More** — text only, no icon, same pill styling

## Section layout
- Centered column: `flex flex-col items-center justify-center`, horizontal padding `px-6`, `max-w-[1080px] mx-auto`
- Vertical centering within viewport (this is the main hero area below header/banner)

## Notes
- Icons import from `src/components/icons.tsx`: `PlusIcon`, `SubmitArrowIcon`, `CreateSlidesIcon`, `BuildWebsiteIcon`, `DevelopDesktopAppsIcon`, `DesignIcon` (all already created)
- Reference screenshots: `docs/design-references/home-desktop-1920-full.png`, `docs/design-references/home-mobile-390-full.png`
- This is a static clone — `contenteditable` div does not need to actually submit; submit button stays in disabled visual state
