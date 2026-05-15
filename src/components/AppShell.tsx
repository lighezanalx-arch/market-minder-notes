import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  TrendingUp,
  Calendar as CalendarIcon,
  ArrowDownToLine,
  Settings as SettingsIcon,
  Lightbulb,
} from "lucide-react";
import { useDB, currentBalance, totals, formatMoney } from "@/lib/store";

const nav = [
  { to: "/strategies", label: "Strategies", icon: Lightbulb },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/equity", label: "Equity", icon: TrendingUp },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell() {
  const db = useDB();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const bal = currentBalance(db);
  const t = totals(db);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-bold tracking-tight">Trading Journal</div>
          <div className="num text-[11px] text-muted-foreground mt-0.5">
            Balance{" "}
            <span
              className={
                bal >= db.startingBalance ? "text-win" : "text-loss"
              }
            >
              {formatMoney(bal, false)}
            </span>
          </div>
        </div>
        <nav className="flex-1 p-2">
          {nav.map((n) => {
            const active =
              path === n.to || (n.to !== "/journal" && path.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
          <div className="flex justify-between py-0.5">
            <span>Positions</span>
            <span className="num text-foreground">{t.count}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>Win rate</span>
            <span
              className={`num ${t.wr >= 50 ? "text-win" : "text-loss"}`}
            >
              {t.wr}%
            </span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>Net P&amp;L</span>
            <span
              className={`num ${t.netPnl >= 0 ? "text-win" : "text-loss"}`}
            >
              {formatMoney(t.netPnl)}
            </span>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
