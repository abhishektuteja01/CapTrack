# Components

## Structure

- `trades/` — Trade-specific components (form, list, filters, delete button)
- `layout/` — App shell components (user menu)
- `ui/` — Generic UI primitives (FadeIn animation, Aurora background, loading progress)

## Patterns

- Use `'use client'` only when the component needs interactivity (forms, state, event handlers).
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes (`clsx` + `tailwind-merge`).
- Tailwind CSS 4 — utility-first, no custom CSS files.
- Animations use Framer Motion (`motion` and `AnimatePresence`).

## Trade Components

- **`trade-form.tsx`** — Client component. Uses `useActionState` with `createTradeAction`. Handles both create and edit modes via the `editTrade` prop. Symbol autocomplete infers asset type and currency.
- **`recent-trades.tsx`** — **Server component**. Queries trades by `user_id`, supports search (ilike on symbol), sorting, and pagination. Renders mobile cards and desktop table.
- **`delete-trade-button.tsx`** — Client component. Wraps `deleteTradeAction` with a confirm dialog. Only needs `tradeId` prop.
- **`trade-filters.tsx`** — Client component. Debounced search input (500ms) that updates URL search params.
- **`symbol-autocomplete.tsx`** — Client component. Calls `/api/symbols?q=` with debounce, returns symbol suggestions.

## Key Props

- `recent-trades.tsx` receives `userId: string` (not portfolioId)
- `trade-form.tsx` receives `platforms: string[]` and optional `editTrade` object
- `delete-trade-button.tsx` receives only `tradeId: string`
