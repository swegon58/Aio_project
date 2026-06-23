# Banner Component Spec

File: `src/components/Banner.tsx`

## Structure

```html
<div class="<wrapper classes>">
  <a href="/team" target="_blank" rel="noopener noreferrer"
     class="flex w-full items-center justify-center gap-[4px] shrink-0 max-md:gap-[8px] hover:opacity-80 duration-300 clickable break-words">
    <p class="text-[14px] font-[500] leading-[20px] text-[var(--text-primary)] text-center max-md:text-[var(--text-primary)]">
      Manus is now part of Meta — bringing AI to businesses worldwide
    </p>
    <ArrowRight size={16} stroke="var(--icon-tertiary)" className="flex-shrink-0" aria-hidden="true" />
  </a>
</div>
```

## Details
- Sits directly above/behind the header, full width, centered content
- Wrapper background: `var(--fill-tsp-white-light)` (`#37352f0a`)
- Link target: `/team`, opens new tab (`target="_blank" rel="noopener noreferrer"`)
- Text: "Manus is now part of Meta — bringing AI to businesses worldwide" — `text-[14px] font-[500] leading-[20px] text-[var(--text-primary)] text-center`
- Trailing icon: lucide-react `ArrowRight`, `size={16}`, `stroke="var(--icon-tertiary)"`, `className="flex-shrink-0"`
- Hover: `hover:opacity-80 duration-300`
- Layout: `flex w-full items-center justify-center gap-[4px] shrink-0 max-md:gap-[8px] break-words`
- Wrapper sizing: full width, small vertical padding (`py-2` / `py-[10px]` — match visual reference screenshot for exact height), positioned above the `<header>`

## Notes
- Import `ArrowRight` from `lucide-react` directly — no custom icon needed
- Reference screenshot: `docs/design-references/home-desktop-1920-full.png` (top strip)
