import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  buildEquitySeries,
  currentBalance,
  formatMoney,
  totals,
  useDB,
} from "@/lib/store";

export const Route = createFileRoute("/equity")({ component: EquityPage });

function EquityPage() {
  const db = useDB();
  const series = React.useMemo(() => buildEquitySeries(db), [db]);
  const t = totals(db);
  const bal = currentBalance(db);

  const peak = series.length
    ? series.reduce((m, p) => (p.balance > m ? p.balance : m), -Infinity)
    : db.startingBalance;
  const trough = series.length
    ? series.reduce((m, p) => (p.balance < m ? p.balance : m), Infinity)
    : db.startingBalance;
  const drawdown = peak > 0 ? ((peak - bal) / peak) * 100 : 0;

  const data = [
    { date: "start", balance: db.startingBalance, label: "Start" },
    ...series.map((p) => ({ date: p.date, balance: p.balance, label: p.date })),
  ];

  const change = bal - db.startingBalance;
  const changePct = db.startingBalance
    ? (change / db.startingBalance) * 100
    : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Equity Curve</h1>
          <p className="text-xs text-muted-foreground">
            Account balance over time
          </p>
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Starting" value={formatMoney(db.startingBalance, false)} />
          <Stat
            label="Current"
            value={formatMoney(bal, false)}
            tone={bal >= db.startingBalance ? "win" : "loss"}
            big
          />
          <Stat
            label="Change"
            value={`${formatMoney(change)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`}
            tone={change >= 0 ? "win" : "loss"}
          />
          <Stat label="Peak" value={formatMoney(peak, false)} tone="win" />
          <Stat
            label="Drawdown from peak"
            value={`${drawdown.toFixed(2)}%`}
            tone={drawdown > 0 ? "loss" : undefined}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          {series.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No data yet — log some trades or set a starting balance.
            </p>
          ) : (
            <div className="h-[460px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.13 220)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.72 0.13 220)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.3 0.012 250)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "oklch(0.65 0.015 250)", fontSize: 11 }}
                    stroke="oklch(0.3 0.012 250)"
                    tickFormatter={(v) =>
                      v === "Start" ? v : v.slice(5)
                    }
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.65 0.015 250)", fontSize: 11 }}
                    stroke="oklch(0.3 0.012 250)"
                    tickFormatter={(v) => `$${v.toLocaleString()}`}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.22 0.012 250)",
                      border: "1px solid oklch(0.3 0.012 250)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "oklch(0.65 0.015 250)" }}
                    formatter={(v: number) => [formatMoney(v, false), "Balance"]}
                  />
                  <ReferenceLine
                    y={db.startingBalance}
                    stroke="oklch(0.55 0.015 250)"
                    strokeDasharray="3 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="oklch(0.72 0.13 220)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Mini label="Positions" value={String(t.count)} />
          <Mini
            label="Win rate"
            value={`${t.wr}%`}
            tone={t.wr >= 50 ? "win" : "loss"}
          />
          <Mini
            label="Gross P&L"
            value={formatMoney(t.grossPnl)}
            tone={t.grossPnl >= 0 ? "win" : "loss"}
          />
          <Mini
            label="Total commissions"
            value={`-$${t.totalComm.toFixed(2)}`}
            tone="loss"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`num font-semibold ${big ? "text-xl" : "text-sm"} ${
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`num text-sm font-medium ${
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
