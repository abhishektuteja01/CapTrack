# Components

## Look ("Instrument")

Calm trading terminal, light only. Tokens live in `src/app/globals.css` (`@theme`): `bg`, `surface`, `subtle`, `line`, `ink`/`ink-2`/`ink-3`, one `accent` (petrol teal), `pos`/`neg`/`warn` (+ `-soft` tints), `series-1..6` for charts.

- IBM Plex Sans for text, IBM Plex Mono for numbers only (`num` utility = mono + tabular figures). `condensed` for column headers and panel titles.
- Hairlines, not shadows. Radius 2–4px. No gradients, glass, glows or entrance animations.
- Color only on change numbers (gain/loss), always with a sign. Use `toneClass()` from `ui/num.tsx`.
- Format every number with `@/lib/format`. Don't write local formatters.

## Structure

- `ui/` — primitives: `Button`/`ButtonLink`, `Panel`/`PanelHeader`, `Table`/`Th`/`Td`/`Tr` (`wide` hides a column on phones), `ShowMore` (phones see a long table's first 5 rows), `Money`/`Delta`/`Pct`, `Sparkline`, `Notice`, `EmptyState`, `Skeleton`, `LocalTime`.
- `layout/` — `AppFrame` (sidebar on desktop; on phones a slim top bar and `BottomNav`, a tab bar with a + menu that opens the add panels on the current page), `nav-links`, `user-menu` (Radix dropdown). Page-level Add buttons are `hidden md:inline-flex`, since phones add from the +.
- `portfolio/` — `OverviewView` and `HoldingsView` render whole screens from a `PortfolioSnapshot`, so the landing page can reuse them with `examplePortfolio()`. Parts: `SummaryStrip`, `PerformanceChart` (client; value vs net invested, optional benchmark, time-proportional x, hover/arrow-key readout), `PriceChart` (client; one holding with trades marked), `AllocationPanel` (client), `HoldingsTable` (client; sortable, Sell per row; a tappable list with a sort picker below `sm`; `interactive={false}` on the landing page), `DerivativesTable`, `MoneyPanel`, `PortfolioNotices`, `StatusBar`, `PlatformFilter`.
- `trades/` — `TradeForm` (client; side toggle, "sell from holdings", what's held on the platform with ¼ / ½ / All and the profit the sale realizes, symbol combobox (Yahoo, fund codes, NSE contracts), contract fields for F&O, currency from the quote, FX on the trade date with a broker-rate override, live total, delete), `CashForm`, `TradeSheet`/`CashSheet` (Radix dialogs), `ActivityTable` (grouped by local day, checkboxes for bulk delete; below `sm` a list whose rows open the entry, with checkboxes after "Select"), `TradeFilters` (URL params), `ImportView` (CSV preview and import).
- `entries/EntrySheets` — server component that opens the right panel from the URL on any page.
- `auth/` — `AuthPanel`, `AuthField`, `GoogleButton` and one form per auth page. Pages are server components that read `?next=` and pass it through `safeNext()` (`@/lib/auth-messages`), so forms render without JS. Show `authErrorMessage()`, never raw Supabase text.
- `settings/` — `BaseCurrencyForm`, `PlatformsEditor` (renames carry over to trades), `NameForm`, `SetupForm` (first run on an empty Overview), `CurrencyPicker`.

## Patterns

- `'use client'` only for interactivity. Server components by default.
- Don't import constants or helpers from a `'use client'` module into a server component (they become client references and render nothing). Shared ones live in `@/lib` (`labels.ts`, `sheet-links.ts`).
- `cn()` from `@/lib/utils` knows the theme tokens, so `text-2xs` and `text-ink-3` don't cancel out.

## Phones

Desktop (768px and up) is the reference; phone changes use `max-md:` / `max-sm:` so they can't leak into it.

- Tables become lists below `sm` (`HoldingsTable`, `ActivityTable`); other tables hide `wide` columns.
- Small chips and row links add `touch` from `@/lib/utils` (36px on phones). Buttons grow on their own.
- Fields are 16px and at least 40px tall on phones (`globals.css`), or iOS zooms in on focus.
- Add/edit forms wrap their total and buttons in `stickyFooter` (from `trade-form`), pinned to the panel's bottom on phones. Touch screens don't autofocus the first field.
- Overview reorders its panels on phones with `max-md:contents` and `max-md:order-*`.
