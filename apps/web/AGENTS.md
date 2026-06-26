<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Aio

See `CLAUDE.md` for product context. This file covers stack/commands only.

## Runtime Boundary
- Product-facing runtime code belongs under `src/lib/aio/`.
- Keep `src/app/api/chat/route.ts` as an orchestration layer, not a dumping ground for runtime mapping, RAG, billing, or persistence helpers.
- Map raw Hermes events through `src/lib/aio/hermes/hermes-event-mapper.ts` into Aio events from `src/lib/aio/runs/aio-run-events.ts`.
- Preserve legacy `data-hermes-*` stream parts until the frontend has a planned migration to `data-aio-*`.
- Local MCP files are ignored; update `.mcp.example.json` only with placeholders.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first
