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
- `trades/` — `TradeForm` (client; side toggle, symbol combobox that accepts typed symbols, currency from the quote, FX rate on the trade date with an optional broker-rate override, live total, in-form delete confirm), `TradeSheet` (Radix dialog opened by `?new` / `?edit=id` on /trades), `TradesTable` (grouped by local day), `TradeFilters` (URL params).
- `auth/` — `AuthPanel`, `AuthField`, `GoogleButton` and one form per auth page. Pages are server components that read `?next=` and pass it through `safeNext()` (`@/lib/auth-messages`), so forms render without JS. Show `authErrorMessage()`, never raw Supabase text.
- `settings/` — `BaseCurrencyForm`, `PlatformsEditor` (renames carry over to trades), `NameForm`, `SetupForm` (first run on an empty Overview), `CurrencyPicker`.

## Patterns

- `'use client'` only for interactivity. Server components by default.
- `cn()` from `@/lib/utils` knows the theme tokens, so `text-2xs` and `text-ink-3` don't cancel out.
