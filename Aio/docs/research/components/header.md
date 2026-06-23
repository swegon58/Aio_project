# Header Component Spec

File: `src/components/Header.tsx`

## Structure

```html
<header class="w-full h-[56px] relative z-20 max-md:hidden">
  <div class="mx-auto max-w-[1080px] h-full py-3 px-6 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center">
    <!-- col 1: logo -->
    <a class="w-fit" href="/">
      <LogoIcon height="32" width="24.42" />
    </a>
    <!-- col 2 (center): nav -->
    <nav class="justify-self-center hidden md:flex items-center gap-2 text-[var(--text-secondary)] text-sm font-[500]">
      <div class="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable" aria-haspopup="dialog">Features</div>
      <div class="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable" aria-haspopup="dialog">Solutions</div>
      <div class="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable" aria-haspopup="dialog">Resources</div>
      <a href="https://events.manus.im" class="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable">Events</a>
      <a href="/team" class="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable">Business</a>
      <a href="/pricing" class="px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable">Pricing</a>
    </nav>
    <!-- col 3: auth buttons -->
    <div class="justify-self-end flex items-center gap-2">
      <button>Sign in</button>
      <button>Sign up</button>
    </div>
  </div>
</header>
```

## Logo
- `LogoIcon` from `src/components/icons.tsx` (already exists)
- `height={32} width={24.42}`, `viewBox="0 0 24 24"`

## Nav links
- "Features", "Solutions", "Resources" → static `<div>` (NOT `<a>`), `aria-haspopup="dialog"`, no dropdown functionality (out of scope) — render as plain styled divs, `cursor-pointer` only via `clickable` class (no-op)
- "Events" → `<a href="https://events.manus.im">`
- "Business" → `<a href="/team">`
- "Pricing" → `<a href="/pricing">`
- All items: `px-3 py-1.5 rounded-[8px] hover:bg-[var(--fill-tsp-white-main)] clickable`
- Container: `justify-self-center hidden md:flex items-center gap-2 text-[var(--text-secondary)] text-sm font-[500]`
- Use Next.js `<Link>` for internal routes (`/team`, `/pricing`), plain `<a target="_blank">` for external (`https://events.manus.im`)

## Sign in / Sign up buttons

**Sign in** (filled black):
- `fontSize: 14px, fontWeight: 500, lineHeight: 18px`
- `color: rgb(255,255,255)` (white)
- `backgroundColor: rgb(26,26,25)` → `bg-[var(--Button-black)]`
- `padding: 0px 8px, height: 32px, borderRadius: 8px`
- `display: flex, justifyContent: center, alignItems: center, gap: 4px`
- Tailwind: `h-8 px-2 rounded-lg bg-[var(--Button-black)] text-white text-sm font-medium leading-[18px] flex items-center justify-center gap-1`

**Sign up** (transparent/outline):
- Same dims as Sign in but `color: rgb(52,50,45)` → `text-[var(--text-primary)]`
- `backgroundColor: rgba(0,0,0,0)` (transparent)
- Tailwind: `h-8 px-2 rounded-lg bg-transparent text-[var(--text-primary)] text-sm font-medium leading-[18px] flex items-center justify-center gap-1 hover:bg-[var(--fill-tsp-white-main)]`

## Container
- `header`: `w-full h-[56px] relative z-20`
- inner: `mx-auto max-w-[1080px] h-full py-3 px-6 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center`
- header `position: relative, zIndex: 20, color: rgb(52,50,45), background: transparent`

## Mobile (< md breakpoint)
- This nav is `max-md:hidden` — for the scope of this clone, a simplified mobile header showing just logo + Sign in/Sign up is acceptable (hide center nav below `md`). Keep it simple — no hamburger menu needed (out of scope).

## Notes
- Use `next/link` for `Link`
- No dropdown dialogs — Features/Solutions/Resources render as static, non-functional divs
