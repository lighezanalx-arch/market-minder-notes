"""Trading Journal — NiceGUI app.

Run with: bash run.sh   (or `python app.py`)
Opens on http://localhost:8080
"""
from __future__ import annotations

import base64
import calendar as cal
import datetime as dt
import json
import uuid
from collections import defaultdict
from pathlib import Path

from nicegui import app as nicegui_app, events, ui

import db

db.init()

# ── theme ───────────────────────────────────────────────────────────────
ui.colors(
    primary="#4ea1ff",
    secondary="#1f6feb",
    accent="#4ea1ff",
    dark="#0d1117",
    positive="#3fb950",
    negative="#f85149",
    warning="#d29922",
    info="#58a6ff",
)
ui.dark_mode().enable()

NAV = [
    ("/strategies", "Strategies", "lightbulb"),
    ("/", "Journal", "menu_book"),
    ("/equity", "Equity", "show_chart"),
    ("/calendar", "Calendar", "calendar_month"),
    ("/withdrawals", "Withdrawals", "north_east"),
    ("/settings", "Settings", "settings"),
]


# ── helpers ─────────────────────────────────────────────────────────────
def uid() -> str:
    return uuid.uuid4().hex[:12]


def fmt_money(n: float, sign: bool = True) -> str:
    s = "+" if sign and n > 0 else ("-" if n < 0 else "")
    return f"{s}${abs(n):,.2f}"


def day_net(date: str) -> float:
    with db.journal() as c:
        rows = c.execute(
            "SELECT COALESCE(pnl,0)-COALESCE(commissions,0) AS n FROM trades WHERE date=?",
            (date,),
        ).fetchall()
    return sum(r["n"] for r in rows)


def current_balance() -> float:
    b = db.get_starting_balance()
    with db.journal() as c:
        b += (
            c.execute(
                "SELECT COALESCE(SUM(COALESCE(pnl,0)-COALESCE(commissions,0)),0) AS s FROM trades"
            ).fetchone()["s"]
        )
        b -= (
            c.execute(
                "SELECT COALESCE(SUM(amount+commissions),0) AS s FROM withdrawals"
            ).fetchone()["s"]
        )
    return b


def equity_series() -> list[dict]:
    dates: set[str] = set()
    with db.journal() as c:
        for r in c.execute("SELECT DISTINCT date FROM days"):
            dates.add(r["date"])
        for r in c.execute("SELECT DISTINCT date FROM withdrawals"):
            dates.add(r["date"])
        withdrawals_by_date: dict[str, float] = defaultdict(float)
        for r in c.execute("SELECT date, amount+commissions AS t FROM withdrawals"):
            withdrawals_by_date[r["date"]] += r["t"]
    bal = db.get_starting_balance()
    points = []
    for d in sorted(dates):
        net = day_net(d)
        bal += net - withdrawals_by_date[d]
        points.append({"date": d, "balance": bal, "net": net, "withdrawn": withdrawals_by_date[d]})
    return points


# ── layout ──────────────────────────────────────────────────────────────
def page_shell(active: str):
    """Render sidebar + return content container."""
    with ui.left_drawer(value=True, fixed=True, bordered=True).classes(
        "bg-[#0d1117] w-60 p-4"
    ):
        ui.label("Trading Journal").classes("text-sm font-semibold tracking-wide")
        bal = current_balance()
        start = db.get_starting_balance()
        ui.label(fmt_money(bal, sign=False)).classes(
            f"text-2xl font-semibold mt-1 {'text-positive' if bal>=start else 'text-negative'}"
        )
        ui.label("current balance").classes("text-[10px] uppercase tracking-wider text-gray-500 mb-4")
        for path, label, icon in NAV:
            cls = "w-full justify-start"
            cls += " text-primary" if path == active else " text-gray-300"
            ui.button(label, icon=icon, on_click=lambda p=path: ui.navigate.to(p)).props(
                "flat align=left no-caps"
            ).classes(cls)
    return ui.column().classes("w-full p-6 gap-4")


# ── JOURNAL ─────────────────────────────────────────────────────────────
@ui.page("/")
def journal_page():
    page_shell("/")
    with ui.row().classes("w-full items-center"):
        ui.label("Journal").classes("text-lg font-semibold")
        ui.space()
        ui.button("+ New Day", on_click=lambda: new_day_dialog()).props("color=primary")

    with db.journal() as c:
        days = c.execute("SELECT date, notes FROM days ORDER BY date DESC").fetchall()

    if not days:
        ui.label("No sessions yet. Click '+ New Day' to start.").classes("text-gray-500")
        return

    for d in days:
        net = day_net(d["date"])
        with ui.expansion(
            f"{d['date']}    {fmt_money(net)}",
            icon="event",
        ).classes("w-full bg-[#161b22] rounded"):
            day_panel(d["date"])


def new_day_dialog():
    with ui.dialog() as dialog, ui.card().classes("w-96"):
        ui.label("New session").classes("text-base font-semibold")
        date_input = ui.input("Date", value=dt.date.today().isoformat()).classes("w-full")
        notes_input = ui.textarea("Notes (optional)").classes("w-full")

        def save():
            with db.journal() as c:
                c.execute(
                    "INSERT OR IGNORE INTO days(date,notes) VALUES(?,?)",
                    (date_input.value, notes_input.value or ""),
                )
            dialog.close()
            ui.navigate.reload()

        with ui.row().classes("w-full justify-end"):
            ui.button("Cancel", on_click=dialog.close).props("flat")
            ui.button("Create", on_click=save).props("color=primary")
    dialog.open()


def day_panel(date: str):
    with db.journal() as c:
        day = c.execute("SELECT * FROM days WHERE date=?", (date,)).fetchone()
        trades = c.execute("SELECT * FROM trades WHERE date=? ORDER BY time", (date,)).fetchall()
        photos = c.execute("SELECT id,caption,mime FROM day_photos WHERE date=?", (date,)).fetchall()

    notes_area = ui.textarea("Day notes", value=day["notes"]).classes("w-full")

    def save_notes():
        with db.journal() as c:
            c.execute("UPDATE days SET notes=? WHERE date=?", (notes_area.value, date))
        ui.notify("Saved")

    with ui.row():
        ui.button("Save notes", on_click=save_notes).props("flat color=primary")
        ui.button("+ Position", on_click=lambda: trade_dialog(date)).props("color=primary")
        ui.button(
            "Delete day",
            on_click=lambda: confirm_delete_day(date),
        ).props("flat color=negative")

    # trades table
    if trades:
        rows = [
            {
                "id": t["id"],
                "time": t["time"],
                "dir": (t["direction"] or "—").upper(),
                "outcome": t["outcome"] or "—",
                "pnl": fmt_money(t["pnl"] or 0),
                "comm": fmt_money(t["commissions"] or 0, sign=False),
                "net": fmt_money((t["pnl"] or 0) - (t["commissions"] or 0)),
                "notes": t["notes"],
            }
            for t in trades
        ]
        ui.table(
            columns=[
                {"name": "time", "label": "Time", "field": "time"},
                {"name": "dir", "label": "Dir", "field": "dir"},
                {"name": "outcome", "label": "Outcome", "field": "outcome"},
                {"name": "pnl", "label": "P&L", "field": "pnl"},
                {"name": "comm", "label": "Comm.", "field": "comm"},
                {"name": "net", "label": "Net", "field": "net"},
                {"name": "notes", "label": "Notes", "field": "notes"},
            ],
            rows=rows,
            row_key="id",
        ).classes("w-full")
    else:
        ui.label("No positions logged.").classes("text-gray-500 text-xs")

    # photos
    ui.label("Screenshots").classes("text-xs uppercase tracking-wider text-gray-500 mt-2")
    upload = ui.upload(
        label="Drop or pick images",
        multiple=True,
        on_upload=lambda e: add_day_photo(date, e),
        auto_upload=True,
    ).props("accept=image/*").classes("w-full")
    upload.on("uploaded", lambda _: ui.navigate.reload())

    if photos:
        with ui.row().classes("flex-wrap gap-2"):
            for p in photos:
                ui.image(f"/photo/day/{p['id']}").classes("w-32 h-32 object-cover rounded")
    else:
        ui.label("No photos yet.").classes("text-gray-500 text-xs")


def add_day_photo(date: str, e: events.UploadEventArguments):
    data = e.content.read()
    with db.journal() as c:
        c.execute(
            "INSERT INTO day_photos(id,date,caption,mime,data,created) VALUES(?,?,?,?,?,?)",
            (uid(), date, e.name, e.type or "image/png", data, dt.datetime.utcnow().isoformat()),
        )


def confirm_delete_day(date: str):
    with ui.dialog() as d, ui.card():
        ui.label(f"Delete session {date}? This removes its trades and photos.")
        with ui.row():
            ui.button("Cancel", on_click=d.close).props("flat")
            def go():
                with db.journal() as c:
                    c.execute("DELETE FROM days WHERE date=?", (date,))
                d.close()
                ui.navigate.reload()
            ui.button("Delete", on_click=go).props("color=negative")
    d.open()


def trade_dialog(date: str, trade=None):
    with ui.dialog() as dialog, ui.card().classes("w-[28rem]"):
        ui.label("Log position").classes("text-base font-semibold")
        time_i = ui.input("Time", value=trade["time"] if trade else dt.datetime.now().strftime("%H:%M")).classes("w-full")
        dir_i = ui.select(["long", "short"], value=trade["direction"] if trade else "long", label="Direction").classes("w-full")
        out_i = ui.select(["win", "loss", "breakeven"], value=trade["outcome"] if trade else "win", label="Outcome").classes("w-full")
        pnl_i = ui.number("P&L", value=trade["pnl"] if trade else 0, format="%.2f").classes("w-full")
        com_i = ui.number("Commissions", value=trade["commissions"] if trade else 0, format="%.2f").classes("w-full")
        notes_i = ui.textarea("Notes", value=trade["notes"] if trade else "").classes("w-full")

        def save():
            with db.journal() as c:
                c.execute(
                    "INSERT INTO trades(id,date,time,direction,outcome,pnl,commissions,notes,created) "
                    "VALUES(?,?,?,?,?,?,?,?,?)",
                    (uid(), date, time_i.value, dir_i.value, out_i.value,
                     float(pnl_i.value or 0), float(com_i.value or 0),
                     notes_i.value or "", dt.datetime.utcnow().isoformat()),
                )
            dialog.close()
            ui.navigate.reload()

        with ui.row().classes("w-full justify-end"):
            ui.button("Cancel", on_click=dialog.close).props("flat")
            ui.button("Save", on_click=save).props("color=primary")
    dialog.open()


# Photo endpoints
@nicegui_app.get("/photo/day/{pid}")
def _day_photo(pid: str):
    from fastapi import Response
    with db.journal() as c:
        row = c.execute("SELECT mime,data FROM day_photos WHERE id=?", (pid,)).fetchone()
    if not row:
        return Response(status_code=404)
    return Response(content=row["data"], media_type=row["mime"])


@nicegui_app.get("/photo/strategy/{pid}")
def _strat_photo(pid: str):
    from fastapi import Response
    with db.strategies() as c:
        row = c.execute("SELECT mime,data FROM strategy_photos WHERE id=?", (pid,)).fetchone()
    if not row:
        return Response(status_code=404)
    return Response(content=row["data"], media_type=row["mime"])


# ── STRATEGIES ──────────────────────────────────────────────────────────
@ui.page("/strategies")
def strategies_page():
    page_shell("/strategies")
    with ui.row().classes("w-full items-center"):
        ui.label("Strategies").classes("text-lg font-semibold")
        ui.space()
        ui.button("+ New Strategy", on_click=new_strategy_dialog).props("color=primary")

    with db.strategies() as c:
        strats = c.execute("SELECT * FROM strategies ORDER BY created DESC").fetchall()

    if not strats:
        ui.label("No strategies yet.").classes("text-gray-500")
        return

    for s in strats:
        with ui.expansion(s["name"], icon="lightbulb").classes("w-full bg-[#161b22] rounded"):
            strategy_panel(s["id"])


def new_strategy_dialog():
    with ui.dialog() as d, ui.card().classes("w-96"):
        ui.label("New strategy").classes("text-base font-semibold")
        name_i = ui.input("Name").classes("w-full")
        notes_i = ui.textarea("Notes").classes("w-full")
        def save():
            if not (name_i.value or "").strip():
                ui.notify("Name required", color="negative"); return
            with db.strategies() as c:
                c.execute(
                    "INSERT INTO strategies(id,name,notes,created) VALUES(?,?,?,?)",
                    (uid(), name_i.value, notes_i.value or "", dt.datetime.utcnow().isoformat()),
                )
            d.close(); ui.navigate.reload()
        with ui.row().classes("w-full justify-end"):
            ui.button("Cancel", on_click=d.close).props("flat")
            ui.button("Create", on_click=save).props("color=primary")
    d.open()


def strategy_panel(sid: str):
    with db.strategies() as c:
        s = c.execute("SELECT * FROM strategies WHERE id=?", (sid,)).fetchone()
        photos = c.execute("SELECT id,caption FROM strategy_photos WHERE strategy_id=?", (sid,)).fetchall()

    name_i = ui.input("Name", value=s["name"]).classes("w-full")
    notes_i = ui.textarea("Notes", value=s["notes"]).classes("w-full")

    def save():
        with db.strategies() as c:
            c.execute("UPDATE strategies SET name=?, notes=? WHERE id=?",
                      (name_i.value, notes_i.value, sid))
        ui.notify("Saved")

    def delete():
        with db.strategies() as c:
            c.execute("DELETE FROM strategies WHERE id=?", (sid,))
        ui.navigate.reload()

    with ui.row():
        ui.button("Save", on_click=save).props("flat color=primary")
        ui.button("Delete strategy", on_click=delete).props("flat color=negative")

    ui.label("Photos").classes("text-xs uppercase tracking-wider text-gray-500 mt-2")
    up = ui.upload(
        label="Drop or pick images",
        multiple=True,
        auto_upload=True,
        on_upload=lambda e: add_strategy_photo(sid, e),
    ).props("accept=image/*").classes("w-full")
    up.on("uploaded", lambda _: ui.navigate.reload())

    if photos:
        with ui.row().classes("flex-wrap gap-2"):
            for p in photos:
                ui.image(f"/photo/strategy/{p['id']}").classes("w-32 h-32 object-cover rounded")


def add_strategy_photo(sid: str, e: events.UploadEventArguments):
    data = e.content.read()
    with db.strategies() as c:
        c.execute(
            "INSERT INTO strategy_photos(id,strategy_id,caption,mime,data,created) VALUES(?,?,?,?,?,?)",
            (uid(), sid, e.name, e.type or "image/png", data, dt.datetime.utcnow().isoformat()),
        )


# ── EQUITY ──────────────────────────────────────────────────────────────
@ui.page("/equity")
def equity_page():
    page_shell("/equity")
    ui.label("Equity").classes("text-lg font-semibold")

    pts = equity_series()
    bal = current_balance()
    start = db.get_starting_balance()
    peak = max((p["balance"] for p in pts), default=start)
    dd = bal - peak

    with db.journal() as c:
        ws = c.execute("SELECT * FROM withdrawals ORDER BY date DESC").fetchall()
    total_wd = sum(w["amount"] + w["commissions"] for w in ws)

    with ui.row().classes("w-full gap-2"):
        stat("Starting", fmt_money(start, sign=False))
        stat("Current", fmt_money(bal, sign=False), positive=bal >= start)
        stat("Peak", fmt_money(peak, sign=False))
        stat("Drawdown", fmt_money(dd), positive=dd >= 0)
        stat("Withdrawn", fmt_money(-total_wd))

    if pts:
        import plotly.graph_objects as go
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=[p["date"] for p in pts],
            y=[p["balance"] for p in pts],
            mode="lines+markers",
            line=dict(color="#4ea1ff"),
            name="Balance",
        ))
        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor="#0d1117",
            plot_bgcolor="#0d1117",
            margin=dict(l=40, r=20, t=20, b=40),
            height=380,
        )
        ui.plotly(fig).classes("w-full")
    else:
        ui.label("No data yet.").classes("text-gray-500")

    ui.label("Withdrawals").classes("text-sm font-semibold mt-4")
    if ws:
        ui.table(
            columns=[
                {"name": "date", "label": "Date", "field": "date"},
                {"name": "amount", "label": "Amount", "field": "amount"},
                {"name": "commissions", "label": "Commissions", "field": "commissions"},
                {"name": "total", "label": "Total", "field": "total"},
                {"name": "note", "label": "Note", "field": "note"},
            ],
            rows=[
                {
                    "date": w["date"],
                    "amount": fmt_money(w["amount"], sign=False),
                    "commissions": fmt_money(w["commissions"], sign=False),
                    "total": fmt_money(-(w["amount"] + w["commissions"])),
                    "note": w["note"],
                }
                for w in ws
            ],
            row_key="date",
        ).classes("w-full")
    else:
        ui.label("No withdrawals yet.").classes("text-gray-500 text-xs")


def stat(label: str, value: str, positive: bool | None = None):
    with ui.card().classes("bg-[#161b22] flex-1 min-w-[140px] py-3"):
        ui.label(label).classes("text-[10px] uppercase tracking-wider text-gray-500")
        cls = "text-lg font-semibold"
        if positive is True: cls += " text-positive"
        elif positive is False: cls += " text-negative"
        ui.label(value).classes(cls)


# ── CALENDAR ────────────────────────────────────────────────────────────
@ui.page("/calendar")
def calendar_page():
    page_shell("/calendar")
    today = dt.date.today()
    month = today.replace(day=1)
    ui.label(month.strftime("%B %Y")).classes("text-lg font-semibold")

    cal_obj = cal.Calendar(firstweekday=0)
    weeks = cal_obj.monthdatescalendar(month.year, month.month)

    with ui.grid(columns=7).classes("w-full gap-1"):
        for name in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]:
            ui.label(name).classes("text-[10px] uppercase tracking-wider text-gray-500 text-center")
        for week in weeks:
            for d in week:
                in_month = d.month == month.month
                date_str = d.isoformat()
                net = day_net(date_str) if in_month else 0
                bg = "bg-[#161b22]" if in_month else "bg-[#0d1117]"
                if net > 0: bg = f"bg-positive/{min(80, 20 + int(abs(net)/50))}"
                elif net < 0: bg = f"bg-negative/{min(80, 20 + int(abs(net)/50))}"
                with ui.card().classes(f"{bg} p-2 min-h-[64px] cursor-pointer"):
                    ui.label(str(d.day)).classes(
                        f"text-xs {'text-gray-300' if in_month else 'text-gray-600'}"
                    )
                    if net:
                        ui.label(fmt_money(net)).classes("text-xs font-semibold")


# ── WITHDRAWALS ─────────────────────────────────────────────────────────
@ui.page("/withdrawals")
def withdrawals_page():
    page_shell("/withdrawals")
    with ui.row().classes("w-full items-center"):
        ui.label("Withdrawals").classes("text-lg font-semibold")
        ui.space()
        ui.button("+ New Withdrawal", on_click=new_withdrawal_dialog).props("color=primary")

    with db.journal() as c:
        ws = c.execute("SELECT * FROM withdrawals ORDER BY date DESC").fetchall()

    if not ws:
        ui.label("No withdrawals yet.").classes("text-gray-500")
        return

    def delete_w(wid: str):
        with db.journal() as c:
            c.execute("DELETE FROM withdrawals WHERE id=?", (wid,))
        ui.navigate.reload()

    for w in ws:
        with ui.card().classes("w-full bg-[#161b22]"):
            with ui.row().classes("w-full items-center"):
                ui.label(w["date"]).classes("text-sm")
                ui.label(fmt_money(w["amount"], sign=False)).classes("text-sm font-semibold")
                ui.label(f"comm. {fmt_money(w['commissions'], sign=False)}").classes("text-xs text-gray-500")
                ui.label(w["note"]).classes("text-xs text-gray-400")
                ui.space()
                ui.button(icon="delete", on_click=lambda wid=w["id"]: delete_w(wid)).props("flat dense color=negative")


def new_withdrawal_dialog():
    with ui.dialog() as d, ui.card().classes("w-96"):
        ui.label("New withdrawal").classes("text-base font-semibold")
        date_i = ui.input("Date", value=dt.date.today().isoformat()).classes("w-full")
        amt_i = ui.number("Amount", value=0, format="%.2f").classes("w-full")
        com_i = ui.number("Commissions", value=0, format="%.2f").classes("w-full")
        note_i = ui.textarea("Note (optional)").classes("w-full")
        def save():
            with db.journal() as c:
                c.execute(
                    "INSERT INTO withdrawals(id,date,amount,commissions,note) VALUES(?,?,?,?,?)",
                    (uid(), date_i.value, float(amt_i.value or 0), float(com_i.value or 0), note_i.value or ""),
                )
            d.close(); ui.navigate.reload()
        with ui.row().classes("w-full justify-end"):
            ui.button("Cancel", on_click=d.close).props("flat")
            ui.button("Save", on_click=save).props("color=primary")
    d.open()


# ── SETTINGS ────────────────────────────────────────────────────────────
@ui.page("/settings")
def settings_page():
    page_shell("/settings")
    ui.label("Settings").classes("text-lg font-semibold")

    start = db.get_starting_balance()
    with ui.card().classes("w-full max-w-xl bg-[#161b22]"):
        ui.label("Starting balance").classes("text-sm font-semibold")
        bal_i = ui.number("USD", value=start, format="%.2f").classes("w-full")
        def save():
            db.set_starting_balance(float(bal_i.value or 0))
            ui.notify("Saved"); ui.navigate.reload()
        ui.button("Save", on_click=save).props("color=primary")

    with ui.card().classes("w-full max-w-xl bg-[#161b22]"):
        ui.label("Backup").classes("text-sm font-semibold")
        ui.label("JSON export omits photos. For full backup, copy data/journal.db and data/strategies/strategies.db.").classes("text-xs text-gray-500")
        def do_export():
            data = json.dumps(db.export_all(), indent=2).encode()
            ui.download(data, filename=f"trading-journal-{dt.date.today().isoformat()}.json")
        ui.button("Export JSON", on_click=do_export).props("color=primary")

    with ui.card().classes("w-full max-w-xl bg-[#161b22]"):
        ui.label("Database locations").classes("text-sm font-semibold")
        ui.label(str(db.JOURNAL_DB)).classes("text-xs font-mono text-gray-400")
        ui.label(str(db.STRATEGIES_DB)).classes("text-xs font-mono text-gray-400")


# ── run ─────────────────────────────────────────────────────────────────
if __name__ in {"__main__", "__mp_main__"}:
    ui.run(
        title="Trading Journal",
        host="127.0.0.1",
        port=8080,
        reload=False,
        show=False,
        dark=True,
    )
