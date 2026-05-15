import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { actions, currentBalance, formatMoney, totals, useDB } from "@/lib/store";
import { Btn, Field, inputCls } from "@/components/ui-kit";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const db = useDB();
  const [bal, setBal] = React.useState(String(db.startingBalance));
  const [saved, setSaved] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const t = totals(db);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trading-journal-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result as string);
        if (!parsed || typeof parsed !== "object" || !parsed.days) {
          alert("Invalid backup file format.");
          return;
        }
        if (!confirm("This will overwrite your current journal. Continue?"))
          return;
        actions.replaceAll({
          startingBalance: parsed.startingBalance ?? 0,
          days: parsed.days ?? {},
          withdrawals: parsed.withdrawals ?? [],
        });
        setBal(String(parsed.startingBalance ?? 0));
      } catch {
        alert("Could not parse file.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="scrollbar-thin h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Account configuration and backups.
          </p>
        </header>

        <Card title="Account balance">
          <div className="grid grid-cols-3 gap-3 rounded-md bg-surface-2 p-4 text-sm">
            <Stat
              label="Starting balance"
              value={formatMoney(db.startingBalance, false)}
            />
            <Stat
              label="Net P&L"
              value={formatMoney(t.netPnl)}
              tone={t.netPnl >= 0 ? "win" : "loss"}
            />
            <Stat
              label="Withdrawn"
              value={`-$${t.totalWithdrawn.toFixed(2)}`}
              tone="loss"
            />
            <div className="col-span-3 mt-2 border-t border-border pt-3">
              <Stat
                label="Current balance"
                value={formatMoney(currentBalance(db), false)}
                big
                tone={currentBalance(db) >= db.startingBalance ? "win" : "loss"}
              />
            </div>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <Field label="Starting balance (USD)">
                <input
                  className={inputCls + " num"}
                  value={bal}
                  onChange={(e) => {
                    setBal(e.target.value);
                    setSaved(false);
                  }}
                />
              </Field>
            </div>
            <Btn
              variant="primary"
              onClick={() => {
                actions.setStartingBalance(parseFloat(bal) || 0);
                setSaved(true);
              }}
            >
              Save
            </Btn>
          </div>
          {saved && (
            <p className="mt-2 text-xs text-win">Saved.</p>
          )}
        </Card>

        <Card title="Backup">
          <p className="mb-3 text-xs text-muted-foreground">
            Export your full journal as a JSON file you can save anywhere on
            your SSD, or restore from a previous backup.
          </p>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={exportJson}>
              Export JSON
            </Btn>
            <Btn onClick={() => fileRef.current?.click()}>
              Import JSON
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={importJson}
            />
          </div>
        </Card>

        <Card title="About">
          <p className="text-xs text-muted-foreground">
            Trading Journal · local-first · data stored on this device.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
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
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`num ${big ? "text-2xl" : "text-base"} font-semibold ${
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
