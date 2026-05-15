## Trading Journal — Desktop App

### Stack
- React 19 + TanStack Start (already scaffolded)
- Electron wrapper, packaged via `@electron/packager`
- Local persistence via `localStorage` (Electron stores it in your user-data folder on the SSD, survives reboots and reinstalls of the app)
- Recharts for the equity curve, custom CSS grid for the calendar heatmap

### Design
- Dark theme, kept similar in spirit to your HTML (deep neutral background, restrained accents)
- **Normal fonts**: Inter for everything (no Syne, no Space Mono). Mono numbers only for prices/P&L using `font-variant-numeric: tabular-nums`
- Cleaner spacing, fewer all-caps micro-labels, same information density
- Accents: one cool accent for actions (cyan-blue), green for wins, red for losses, amber for breakeven

### App structure (routes)
```
/journal      Sessions list + day detail (the current HTML, ported)
/equity       Cumulative P&L line chart + key stats
/calendar     Month heatmap, click a day to jump to it
/withdrawals  List + create withdrawal (amount, date, commissions, note)
/settings     Starting balance (editable), export/import JSON, app version
```
Persistent left nav with these 5 items, plus the existing sessions tree inside `/journal`.

### Data model (single localStorage object)
```
{
  startingBalance: number,
  days: { "YYYY-MM-DD": { notes, trades: [...], photos: [...] } },
  withdrawals: [ { id, date, amount, commissions, note } ]
}
```
- **Current balance** = `startingBalance + sum(trade.pnl - trade.commissions) − sum(withdrawal.amount + withdrawal.commissions)`
- Equity curve plots that running total day-by-day
- Calendar heatmap colors cells by net daily P&L

### Features ported from the HTML
Sessions sidebar (year → month → day tree), new day, edit day notes, delete day, log position (time/direction/P&L/commissions/notes), edit/delete trade, attach photos with lightbox + zoom + pan, drag-drop + paste screenshots, daily/monthly stats bar, JSON export/import.

### Features added
- **Editable starting balance** in `/settings` — feeds every balance calc
- **Withdrawals page** — table of withdrawals; "+ New Withdrawal" modal with date, amount, commissions, optional note; deductions show in equity curve
- **Equity curve** — line chart of running balance over time, with peak / drawdown / current balance stats
- **Calendar heatmap** — month view, green/red intensity per day, click jumps to that day in `/journal`

### Electron packaging
- `electron/main.cjs` opens the built React app in a 1280×800 BrowserWindow
- `vite.config.ts` gets `base: './'` for `file://` loading
- I'll build a Linux `.tar.gz` you can run, and offer Windows `.zip` / macOS `.zip` builds on request — `.exe` and `.dmg` installers can't be produced from this sandbox

### Out of scope for v1
Multi-user, cloud sync, broker import (CSV from IBKR/TradingView), tags/strategy fields — easy to add later if you want.

### Build order
1. Design system (dark theme, Inter, tokens) and left nav layout
2. Data layer (typed store + localStorage hook + balance/equity selectors)
3. `/journal` — port the HTML feature-for-feature
4. `/withdrawals` + `/settings` (starting balance)
5. `/equity` chart + `/calendar` heatmap
6. Electron wrap + packaged build

Approve and I'll start.