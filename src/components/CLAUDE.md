# Components

## Look ("Instrument")

Calm trading terminal, light only. Tokens live in `src/app/globals.css` (`@theme`): `bg`, `surface`, `subtle`, `line`, `ink`/`ink-2`/`ink-3`, one `accent` (petrol teal), `pos`/`neg`/`warn` (+ `-soft` tints), `series-1..6` for charts.

- IBM Plex Sans for text, IBM Plex Mono for numbers only (`num` utility = mono + tabular figures). `condensed` for column headers and panel titles.
- Hairlines, not shadows. Radius 2–4px. No gradients, glass, glows or entrance animations.
- Color only on change numbers (gain/loss), always with a sign. Use `toneClass()` from `ui/num.tsx`.
- Format every number with `@/lib/format`. Don't write local formatters.

## Structure

- `ui/` — primitives: `Button`/`ButtonLink`, `Panel`/`PanelHeader`, `Table`/`Th`/`Td`/`Tr` (`wide` hides a column on phones), `Money`/`Delta`/`Pct`, `Sparkline`, `Notice`, `EmptyState`, `Skeleton`, `LocalTime`.
- `layout/` — `AppFrame` (sidebar on desktop, top bar on mobile), `nav-links`, `user-menu` (Radix dropdown).
- `portfolio/` — `OverviewView` and `HoldingsView` render whole screens from a `PortfolioSnapshot`, so the landing page can reuse them with `examplePortfolio()`. Parts: `SummaryStrip`, `PerformanceChart` (client; time-proportional x, hover/arrow-key readout), `AllocationPanel` (client), `HoldingsTable`, `StatusBar`, `PlatformFilter`.
- `trades/` — trade form, list, filters, delete button (restyle pending).

## Patterns

- `'use client'` only for interactivity. Server components by default.
- `cn()` from `@/lib/utils` knows the theme tokens, so `text-2xs` and `text-ink-3` don't cancel out.
