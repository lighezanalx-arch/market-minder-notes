import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayHasPnl, dayNetPnl, formatMoney, useDB } from "@/lib/store";
import { Btn } from "@/components/ui-kit";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

function CalendarPage() {
  const db = useDB();
  const nav = useNavigate();
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth()); // 0-11

  const monthName = new Date(year, month, 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Build calendar grid (Mon-Sun)
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  // Month stats
  const monthDays = Object.entries(db.days).filter(([d]) => {
    const [y, m] = d.split("-").map(Number);
    return y === year && m === month + 1;
  });
  const monthPnl = monthDays.reduce(
    (s, [, day]) => s + dayNetPnl(day),
    0,
  );
  const greenCount = monthDays.filter(([, d]) => dayNetPnl(d) > 0).length;
  const redCount = monthDays.filter(([, d]) => dayNetPnl(d) < 0).length;

  // Color intensity helper
  const allPnls = monthDays.map(([, d]) => Math.abs(dayNetPnl(d)));
  const maxAbs = Math.max(1, ...allPnls);

  const cellBg = (date: string) => {
    const day = db.days[date];
    if (!day) return undefined;
    if (!dayHasPnl(day)) return "var(--muted)";
    const p = dayNetPnl(day);
    if (p === 0) return "color-mix(in oklab, var(--be) 25%, transparent)";
    const intensity = Math.min(1, Math.abs(p) / maxAbs);
    const pct = 15 + intensity * 60;
    return p > 0
      ? `color-mix(in oklab, var(--win) ${pct}%, transparent)`
      : `color-mix(in oklab, var(--loss) ${pct}%, transparent)`;
  };

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <div className="flex-1">
          <h1 className="text-base font-semibold">Calendar</h1>
          <p className="text-xs text-muted-foreground">
            P&amp;L heatmap by day
          </p>
        </div>
        <Btn onClick={goPrev}>
          <ChevronLeft size={14} />
        </Btn>
        <span className="num min-w-[160px] text-center text-sm font-semibold">
          {monthName}
        </span>
        <Btn onClick={goNext}>
          <ChevronRight size={14} />
        </Btn>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-md bg-surface-2 px-4 py-3 text-xs">
          <Stat label="Trading days" value={String(monthDays.length)} />
          <Stat
            label="Green"
            value={String(greenCount)}
            tone="win"
          />
          <Stat
            label="Red"
            value={String(redCount)}
            tone="loss"
          />
          <Stat
            label="Month net P&L"
            value={formatMoney(monthPnl)}
            tone={monthPnl >= 0 ? "win" : "loss"}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="aspect-square" />;
              const day = db.days[c.date];
              const pnl = day && dayHasPnl(day) ? dayNetPnl(day) : null;
              const positions = day
                ? day.trades.filter((t) => t.type === "position").length
                : 0;
              const hasDay = !!day;
              return (
                <button
                  key={c.date}
                  onClick={() => {
                    if (hasDay) nav({ to: "/journal" });
                  }}
                  disabled={!hasDay}
                  className={`relative flex aspect-square flex-col items-start justify-between rounded-md border border-border p-2 text-left transition-all ${
                    hasDay
                      ? "cursor-pointer hover:border-primary"
                      : "opacity-50"
                  }`}
                  style={{ background: cellBg(c.date) }}
                  title={hasDay ? c.date : undefined}
                >
                  <span className="num text-xs font-semibold">{c.day}</span>
                  {pnl !== null && (
                    <span
                      className={`num text-[11px] font-semibold ${pnl >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {formatMoney(pnl)}
                    </span>
                  )}
                  {hasDay && (
                    <span className="num absolute right-1.5 top-1.5 text-[9px] text-muted-foreground">
                      {positions}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`num font-semibold ${
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
