# Trading Journal — Python (NiceGUI) app

Local-first trading journal. Pure Python, two SQLite databases on your SSD,
no cloud, no Node.

## Run

Requires **Python 3.10+**.

```bash
cd python
bash run.sh
```

Then open <http://localhost:8080>.

On first launch it creates:

```
python/
  data/
    journal.db                 # starting balance, days, trades, withdrawals
    strategies/
      strategies.db            # strategies + their notes & photos
```

Photos are stored as BLOBs inside the SQLite files, so a single `.db` file
is a complete backup.

## Pages

- **Journal** — sessions tree, day notes, log positions, attach screenshots
- **Strategies** — separate notebook, notes + photo galleries per strategy
- **Equity** — running balance line chart + withdrawals table
- **Calendar** — month heatmap colored by daily net P&L
- **Withdrawals** — table + create modal (amount, commissions, date, note)
- **Settings** — editable starting balance, JSON export/import

## Backup

Just copy the two `.db` files anywhere. To move to another machine, drop
them into the same `data/` layout and run the app.

## Storage paths

Override defaults via env vars:

```bash
JOURNAL_DB=/mnt/ssd/journal.db STRATEGIES_DB=/mnt/ssd/strats.db bash run.sh
```
