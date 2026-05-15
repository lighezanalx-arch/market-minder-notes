import { useSyncExternalStore } from "react";

export type Trade = {
  id: string;
  type: "position";
  time: string;
  direction: "long" | "short" | null;
  outcome: "win" | "loss" | "breakeven" | null;
  pnl: number | null;
  commissions: number | null;
  notes: string;
  created: string;
};

export type Photo = {
  id: string;
  type: "photo";
  image: string; // data URL
  caption: string;
  created: string;
};

export type DayEntry = Trade | Photo;

export type Day = {
  notes: string;
  trades: DayEntry[];
};

export type Withdrawal = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  commissions: number;
  note: string;
};

export type Strategy = {
  id: string;
  name: string;
  notes: string;
  photos: Photo[];
  created: string;
};

export type DB = {
  startingBalance: number;
  days: Record<string, Day>;
  withdrawals: Withdrawal[];
  strategies: Strategy[];
};

const KEY = "trading_journal_v1";
const LEGACY_KEY = "es_journal_v2";

const empty = (): DB => ({ startingBalance: 0, days: {}, withdrawals: [], strategies: [] });

function load(): DB {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        startingBalance: parsed.startingBalance ?? 0,
        days: parsed.days ?? {},
        withdrawals: parsed.withdrawals ?? [],
        strategies: parsed.strategies ?? [],
      };
    }
    // migrate legacy
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy);
      return { startingBalance: 0, days: p.days ?? {}, withdrawals: [], strategies: [] };
    }
  } catch {
    /* ignore */
  }
  return empty();
}

let state: DB = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.add; // noop ref to keep linter happy
  listeners.forEach((l) => l());
}

export function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  emit();
}

export function getDB(): DB {
  return state;
}

export function setDB(next: DB) {
  state = next;
  persist();
}

function update(mutator: (s: DB) => void) {
  const next: DB = {
    startingBalance: state.startingBalance,
    days: { ...state.days },
    withdrawals: [...state.withdrawals],
    strategies: [...state.strategies],
  };
  mutator(next);
  state = next;
  persist();
}

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

// ── ACTIONS ────────────────────────────────────────────────────────────────
export const actions = {
  setStartingBalance(v: number) {
    update((s) => {
      s.startingBalance = v;
    });
  },
  addDay(date: string, notes: string) {
    update((s) => {
      if (!s.days[date]) s.days[date] = { notes, trades: [] };
      else s.days[date] = { ...s.days[date], notes };
    });
  },
  updateDay(oldDate: string, newDate: string, notes: string) {
    update((s) => {
      const day = s.days[oldDate];
      if (!day) return;
      const updated = { ...day, notes };
      if (oldDate !== newDate) {
        s.days = { ...s.days };
        delete s.days[oldDate];
        s.days[newDate] = updated;
      } else {
        s.days[oldDate] = updated;
      }
    });
  },
  deleteDay(date: string) {
    update((s) => {
      s.days = { ...s.days };
      delete s.days[date];
    });
  },
  addTrade(date: string, trade: Trade) {
    update((s) => {
      const day = s.days[date];
      if (!day) return;
      s.days[date] = { ...day, trades: [...day.trades, trade] };
    });
  },
  updateTrade(date: string, trade: Trade) {
    update((s) => {
      const day = s.days[date];
      if (!day) return;
      s.days[date] = {
        ...day,
        trades: day.trades.map((t) => (t.id === trade.id ? trade : t)),
      };
    });
  },
  deleteEntry(date: string, id: string) {
    update((s) => {
      const day = s.days[date];
      if (!day) return;
      s.days[date] = { ...day, trades: day.trades.filter((t) => t.id !== id) };
    });
  },
  addPhoto(date: string, photo: Photo) {
    update((s) => {
      const day = s.days[date];
      if (!day) return;
      s.days[date] = { ...day, trades: [...day.trades, photo] };
    });
  },
  addWithdrawal(w: Withdrawal) {
    update((s) => {
      s.withdrawals = [...s.withdrawals, w];
    });
  },
  deleteWithdrawal(id: string) {
    update((s) => {
      s.withdrawals = s.withdrawals.filter((w) => w.id !== id);
    });
  },
  addStrategy(s: Strategy) {
    update((db) => {
      db.strategies = [...db.strategies, s];
    });
  },
  updateStrategy(id: string, patch: Partial<Omit<Strategy, "id" | "created">>) {
    update((db) => {
      db.strategies = db.strategies.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      );
    });
  },
  deleteStrategy(id: string) {
    update((db) => {
      db.strategies = db.strategies.filter((s) => s.id !== id);
    });
  },
  addStrategyPhoto(id: string, photo: Photo) {
    update((db) => {
      db.strategies = db.strategies.map((s) =>
        s.id === id ? { ...s, photos: [...s.photos, photo] } : s,
      );
    });
  },
  deleteStrategyPhoto(id: string, photoId: string) {
    update((db) => {
      db.strategies = db.strategies.map((s) =>
        s.id === id
          ? { ...s, photos: s.photos.filter((p) => p.id !== photoId) }
          : s,
      );
    });
  },
    setDB(next);
  },
};

// ── SELECTORS ──────────────────────────────────────────────────────────────
export function isPosition(e: DayEntry): e is Trade {
  return e.type === "position";
}
export function isPhoto(e: DayEntry): e is Photo {
  return e.type === "photo";
}

export function dayNetPnl(day: Day | undefined): number {
  if (!day) return 0;
  return day.trades
    .filter(isPosition)
    .reduce((s, t) => s + ((t.pnl ?? 0) - (t.commissions ?? 0)), 0);
}

export function dayHasPnl(day: Day | undefined): boolean {
  if (!day) return false;
  return day.trades.some((t) => isPosition(t) && t.pnl !== null);
}

export type EquityPoint = {
  date: string;
  balance: number;
  dayPnl: number;
  withdrawn: number;
};

export function buildEquitySeries(db: DB): EquityPoint[] {
  const dates = new Set<string>();
  Object.keys(db.days).forEach((d) => dates.add(d));
  db.withdrawals.forEach((w) => dates.add(w.date));
  const sorted = Array.from(dates).sort();
  let balance = db.startingBalance;
  const points: EquityPoint[] = [];
  for (const date of sorted) {
    const dp = dayNetPnl(db.days[date]);
    const wd = db.withdrawals
      .filter((w) => w.date === date)
      .reduce((s, w) => s + w.amount + w.commissions, 0);
    balance += dp - wd;
    points.push({ date, balance, dayPnl: dp, withdrawn: wd });
  }
  return points;
}

export function currentBalance(db: DB): number {
  let b = db.startingBalance;
  Object.values(db.days).forEach((d) => {
    b += dayNetPnl(d);
  });
  db.withdrawals.forEach((w) => {
    b -= w.amount + w.commissions;
  });
  return b;
}

export function totals(db: DB) {
  const positions = Object.values(db.days).flatMap((d) =>
    d.trades.filter(isPosition),
  );
  const wins = positions.filter((p) => p.outcome === "win").length;
  const losses = positions.filter((p) => p.outcome === "loss").length;
  const bes = positions.filter((p) => p.outcome === "breakeven").length;
  const grossPnl = positions.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalComm = positions.reduce((s, t) => s + (t.commissions ?? 0), 0);
  const totalWithdrawn = db.withdrawals.reduce(
    (s, w) => s + w.amount + w.commissions,
    0,
  );
  const wr = positions.length ? Math.round((wins / positions.length) * 100) : 0;
  return {
    count: positions.length,
    wins,
    losses,
    bes,
    wr,
    grossPnl,
    totalComm,
    netPnl: grossPnl - totalComm,
    days: Object.keys(db.days).length,
    totalWithdrawn,
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function formatMoney(n: number, withSign = true): string {
  const sign = withSign && n > 0 ? "+" : "";
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${n < 0 ? "-" : ""}$${str}`;
}
