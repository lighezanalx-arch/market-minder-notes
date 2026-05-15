import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  ImagePlus,
  Image as ImageIcon,
  Camera,
} from "lucide-react";
import {
  actions,
  dayHasPnl,
  dayNetPnl,
  formatMoney,
  isPhoto,
  isPosition,
  uid,
  useDB,
  type Photo,
  type Trade,
} from "@/lib/store";
import { Btn, Field, Modal, inputCls, textareaCls } from "@/components/ui-kit";
import { Lightbox } from "@/components/Lightbox";

export const Route = createFileRoute("/journal")({ component: JournalPage });

const monthNames = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function PnlPill({ v }: { v: number | null }) {
  if (v === null || v === 0) return null;
  return (
    <span
      className={`num text-[11px] ${v > 0 ? "text-win" : "text-loss"}`}
    >
      {formatMoney(v)}
    </span>
  );
}

function JournalPage() {
  const db = useDB();
  const [currentDay, setCurrentDay] = React.useState<string | null>(null);
  const [openYears, setOpenYears] = React.useState<Record<string, boolean>>({});
  const [openMonths, setOpenMonths] = React.useState<Record<string, boolean>>({});

  // Auto-select most recent day on first load
  React.useEffect(() => {
    if (currentDay) return;
    const days = Object.keys(db.days).sort().reverse();
    if (days.length) {
      setCurrentDay(days[0]);
      const [y, m] = days[0].split("-");
      setOpenYears((s) => ({ ...s, [y]: true }));
      setOpenMonths((s) => ({ ...s, [`${y}-${m}`]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── tree data ────────────────────────────────────────────────────────────
  const tree = React.useMemo(() => {
    const years: Record<string, Record<string, string[]>> = {};
    Object.keys(db.days)
      .sort()
      .reverse()
      .forEach((dateStr) => {
        const [y, m] = dateStr.split("-");
        if (!years[y]) years[y] = {};
        if (!years[y][m]) years[y][m] = [];
        years[y][m].push(dateStr);
      });
    return years;
  }, [db.days]);

  // ── modal state ──────────────────────────────────────────────────────────
  const [newDayOpen, setNewDayOpen] = React.useState(false);
  const [editDayOpen, setEditDayOpen] = React.useState(false);
  const [delDayOpen, setDelDayOpen] = React.useState(false);
  const [tradeOpen, setTradeOpen] = React.useState(false);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [viewTrade, setViewTrade] = React.useState<Trade | null>(null);
  const [delTradeId, setDelTradeId] = React.useState<string | null>(null);
  const [delPhotoId, setDelPhotoId] = React.useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = React.useState<Photo | null>(null);
  const [pendingPhoto, setPendingPhoto] = React.useState<string | null>(null);

  // ── paste anywhere → opens add-photo modal ───────────────────────────────
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!currentDay) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            readImage(file).then((b64) => {
              setPendingPhoto(b64);
              setPhotoOpen(true);
            });
          }
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [currentDay]);

  const day = currentDay ? db.days[currentDay] : null;
  const positions = day ? day.trades.filter(isPosition) : [];
  const photos = day ? day.trades.filter(isPhoto) : [];

  const dayStats = React.useMemo(() => {
    const wins = positions.filter((p) => p.outcome === "win").length;
    const losses = positions.filter((p) => p.outcome === "loss").length;
    const bes = positions.filter((p) => p.outcome === "breakeven").length;
    const wr = positions.length
      ? Math.round((wins / positions.length) * 100)
      : 0;
    const grossPnl = positions.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalComm = positions.reduce((s, t) => s + (t.commissions ?? 0), 0);
    return {
      wins,
      losses,
      bes,
      wr,
      grossPnl,
      totalComm,
      netPnl: grossPnl - totalComm,
    };
  }, [positions]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* SESSIONS TREE */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sessions
          </span>
          <Btn
            variant="primary"
            className="!px-2 !py-1 !text-xs"
            onClick={() => setNewDayOpen(true)}
          >
            <Plus size={12} /> Day
          </Btn>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto py-2">
          {Object.keys(tree).length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No sessions yet — add a day to get started.
            </div>
          )}
          {Object.keys(tree)
            .sort()
            .reverse()
            .map((year) => {
              const yearTrades = Object.values(tree[year])
                .flat()
                .flatMap((d) => db.days[d]?.trades ?? []);
              const yearPnl = yearTrades.filter(isPosition).length
                ? yearTrades
                    .filter(isPosition)
                    .reduce(
                      (s, t) => s + ((t.pnl ?? 0) - (t.commissions ?? 0)),
                      0,
                    )
                : null;
              const yOpen = openYears[year] ?? true;
              return (
                <div key={year}>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-surface-2"
                    onClick={() =>
                      setOpenYears((s) => ({ ...s, [year]: !yOpen }))
                    }
                  >
                    <ChevronRight
                      size={12}
                      className={`shrink-0 transition-transform ${yOpen ? "rotate-90" : ""}`}
                    />
                    <span className="flex-1">{year}</span>
                    <PnlPill v={yearPnl} />
                  </button>
                  {yOpen &&
                    Object.keys(tree[year])
                      .sort()
                      .reverse()
                      .map((m) => {
                        const monthKey = `${year}-${m}`;
                        const mOpen = openMonths[monthKey] ?? true;
                        const mTrades = tree[year][m].flatMap(
                          (d) => db.days[d]?.trades ?? [],
                        );
                        const mPnl = mTrades.filter(isPosition).length
                          ? mTrades
                              .filter(isPosition)
                              .reduce(
                                (s, t) =>
                                  s + ((t.pnl ?? 0) - (t.commissions ?? 0)),
                                0,
                              )
                          : null;
                        return (
                          <div key={m}>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-1 pl-7 text-left text-[13px] text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                              onClick={() =>
                                setOpenMonths((s) => ({
                                  ...s,
                                  [monthKey]: !mOpen,
                                }))
                              }
                            >
                              <ChevronRight
                                size={11}
                                className={`shrink-0 transition-transform ${mOpen ? "rotate-90" : ""}`}
                              />
                              <span className="flex-1">
                                {monthNames[parseInt(m)]}
                              </span>
                              <PnlPill v={mPnl} />
                            </button>
                            {mOpen &&
                              tree[year][m]
                                .sort()
                                .reverse()
                                .map((dateStr) => {
                                  const d = db.days[dateStr];
                                  const dpos = d.trades.filter(isPosition);
                                  const dPnl = dayHasPnl(d)
                                    ? dayNetPnl(d)
                                    : null;
                                  const active = currentDay === dateStr;
                                  const dayNum = parseInt(dateStr.split("-")[2]);
                                  return (
                                    <button
                                      key={dateStr}
                                      onClick={() => setCurrentDay(dateStr)}
                                      className={`flex w-full items-center gap-2 px-3 py-1 pl-11 text-left text-[12px] transition-colors ${
                                        active
                                          ? "bg-primary/10 text-primary"
                                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                                      }`}
                                    >
                                      <span className="num flex-1">
                                        {monthNames[parseInt(m)]} {dayNum}
                                      </span>
                                      <PnlPill v={dPnl} />
                                      <span className="num rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {dpos.length}
                                      </span>
                                    </button>
                                  );
                                })}
                          </div>
                        );
                      })}
                </div>
              );
            })}
        </div>
      </aside>

      {/* CONTENT */}
      <section className="flex flex-1 flex-col overflow-hidden">
        {!day ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ImageIcon size={36} className="opacity-30" />
            <p className="text-sm">Select a day from the sidebar</p>
            <p className="text-xs opacity-70">or create a new trading day</p>
          </div>
        ) : (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
              <div className="flex-1">
                <div className="text-base font-semibold">
                  {new Date(currentDay! + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </div>
                <div className="num text-xs text-muted-foreground">
                  {positions.length} position
                  {positions.length !== 1 && "s"} · {photos.length} photo
                  {photos.length !== 1 && "s"}
                </div>
              </div>
              <Btn onClick={() => setEditDayOpen(true)}>
                <Pencil size={13} /> Edit
              </Btn>
              <Btn variant="danger" onClick={() => setDelDayOpen(true)}>
                <Trash2 size={13} /> Delete
              </Btn>
              <Btn onClick={() => { setPendingPhoto(null); setPhotoOpen(true); }}>
                <ImagePlus size={13} /> Photo
              </Btn>
              <Btn variant="primary" onClick={() => setTradeOpen(true)}>
                <Plus size={13} /> Position
              </Btn>
            </header>

            <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-1 border-b border-border bg-surface px-6 py-2 text-xs">
              <Stat label="W/L/BE">
                <span className="text-win num">{dayStats.wins}</span>/
                <span className="text-loss num">{dayStats.losses}</span>/
                <span className="num">{dayStats.bes}</span>
              </Stat>
              <Stat label="Win rate">
                <span
                  className={`num ${dayStats.wr >= 50 ? "text-win" : "text-loss"}`}
                >
                  {dayStats.wr}%
                </span>
              </Stat>
              {dayHasPnl(day) && (
                <>
                  <Stat label="Gross">
                    <span
                      className={`num ${dayStats.grossPnl >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {formatMoney(dayStats.grossPnl)}
                    </span>
                  </Stat>
                  {dayStats.totalComm > 0 && (
                    <Stat label="Comm">
                      <span className="num text-loss">
                        -${dayStats.totalComm.toFixed(2)}
                      </span>
                    </Stat>
                  )}
                  <Stat label="Net">
                    <span
                      className={`num font-semibold ${dayStats.netPnl >= 0 ? "text-win" : "text-loss"}`}
                    >
                      {formatMoney(dayStats.netPnl)}
                    </span>
                  </Stat>
                </>
              )}
              {day.notes && (
                <Stat label="Session">
                  <span className="max-w-[400px] truncate" title={day.notes}>
                    {day.notes}
                  </span>
                </Stat>
              )}
            </div>

            <div
              className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (!file?.type.startsWith("image/")) return;
                const b64 = await readImage(file);
                setPendingPhoto(b64);
                setPhotoOpen(true);
              }}
            >
              <div className="mb-6 rounded-md border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
                Drop a screenshot anywhere here · or paste with{" "}
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px]">
                  Ctrl+V
                </kbd>
              </div>

              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Positions
                </h3>
                {positions.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground">
                    No positions logged.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Time</th>
                          <th className="px-3 py-2 font-medium">Dir</th>
                          <th className="px-3 py-2 font-medium">Gross</th>
                          <th className="px-3 py-2 font-medium">Comm</th>
                          <th className="px-3 py-2 font-medium">Net</th>
                          <th className="px-3 py-2 font-medium">Notes</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((p) => {
                          const net = (p.pnl ?? 0) - (p.commissions ?? 0);
                          const sideColor =
                            p.outcome === "win"
                              ? "border-l-win"
                              : p.outcome === "loss"
                              ? "border-l-loss"
                              : "border-l-be";
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setViewTrade(p)}
                              className={`cursor-pointer border-b border-border last:border-0 border-l-2 ${sideColor} hover:bg-surface-2`}
                            >
                              <td className="num px-3 py-2 text-muted-foreground">
                                {p.time || "--:--"}
                              </td>
                              <td
                                className={`px-3 py-2 text-xs font-semibold ${p.direction === "long" ? "text-long" : "text-short"}`}
                              >
                                {p.direction?.toUpperCase() ?? "—"}
                              </td>
                              <td
                                className={`num px-3 py-2 ${(p.pnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}
                              >
                                {p.pnl !== null
                                  ? formatMoney(p.pnl)
                                  : "—"}
                              </td>
                              <td className="num px-3 py-2 text-loss/80">
                                {p.commissions
                                  ? `-$${p.commissions.toFixed(2)}`
                                  : "—"}
                              </td>
                              <td
                                className={`num px-3 py-2 font-semibold ${net >= 0 ? "text-win" : "text-loss"}`}
                              >
                                {p.pnl !== null ? formatMoney(net) : "—"}
                              </td>
                              <td className="max-w-[260px] truncate px-3 py-2 text-xs text-muted-foreground">
                                {p.notes || ""}
                              </td>
                              <td
                                className="px-2 py-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => setDelTradeId(p.id)}
                                  className="rounded p-1 text-muted-foreground hover:bg-loss/10 hover:text-loss"
                                  aria-label="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Photos
                </h3>
                {photos.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground">
                    No photos — drop or paste a screenshot.
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                    {photos.map((ph) => (
                      <button
                        key={ph.id}
                        onClick={() => setLightboxPhoto(ph)}
                        className="group overflow-hidden rounded-md border border-border bg-surface text-left transition-colors hover:border-primary"
                      >
                        <img
                          src={ph.image}
                          alt={ph.caption || ""}
                          loading="lazy"
                          className="block aspect-video w-full object-cover"
                        />
                        <div className="flex items-center gap-2 px-3 py-2 text-xs">
                          <Camera
                            size={12}
                            className="text-muted-foreground"
                          />
                          <span className="flex-1 truncate text-muted-foreground">
                            {ph.caption || "Photo"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* MODALS */}
      <NewDayModal
        open={newDayOpen}
        onClose={() => setNewDayOpen(false)}
        onCreate={(date, notes) => {
          actions.addDay(date, notes);
          setCurrentDay(date);
          const [y, m] = date.split("-");
          setOpenYears((s) => ({ ...s, [y]: true }));
          setOpenMonths((s) => ({ ...s, [`${y}-${m}`]: true }));
          setNewDayOpen(false);
        }}
      />

      {currentDay && day && (
        <EditDayModal
          open={editDayOpen}
          onClose={() => setEditDayOpen(false)}
          date={currentDay}
          notes={day.notes}
          onSave={(newDate, notes) => {
            actions.updateDay(currentDay, newDate, notes);
            setCurrentDay(newDate);
            setEditDayOpen(false);
          }}
        />
      )}

      <Modal
        open={delDayOpen}
        onClose={() => setDelDayOpen(false)}
        title="Delete Day"
        danger
        footer={
          <>
            <Btn onClick={() => setDelDayOpen(false)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (currentDay) actions.deleteDay(currentDay);
                setCurrentDay(null);
                setDelDayOpen(false);
              }}
            >
              Delete Day
            </Btn>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete this entire trading day and all its trades and photos? This
          cannot be undone.
        </p>
      </Modal>

      {currentDay && (
        <TradeModal
          open={tradeOpen}
          onClose={() => setTradeOpen(false)}
          onSave={(t) => {
            actions.addTrade(currentDay, t);
            setTradeOpen(false);
          }}
        />
      )}

      {currentDay && (
        <PhotoModal
          open={photoOpen}
          onClose={() => {
            setPhotoOpen(false);
            setPendingPhoto(null);
          }}
          initial={pendingPhoto}
          onSave={(image, caption) => {
            actions.addPhoto(currentDay, {
              id: uid(),
              type: "photo",
              image,
              caption,
              created: new Date().toISOString(),
            });
            setPhotoOpen(false);
            setPendingPhoto(null);
          }}
        />
      )}

      <ViewTradeModal
        trade={viewTrade}
        onClose={() => setViewTrade(null)}
        onDelete={() => {
          if (viewTrade && currentDay) {
            actions.deleteEntry(currentDay, viewTrade.id);
            setViewTrade(null);
          }
        }}
      />

      <Modal
        open={!!delTradeId}
        onClose={() => setDelTradeId(null)}
        title="Delete Position"
        danger
        footer={
          <>
            <Btn onClick={() => setDelTradeId(null)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (delTradeId && currentDay)
                  actions.deleteEntry(currentDay, delTradeId);
                setDelTradeId(null);
              }}
            >
              Delete
            </Btn>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete this position? This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={!!delPhotoId}
        onClose={() => setDelPhotoId(null)}
        title="Delete Photo"
        danger
        footer={
          <>
            <Btn onClick={() => setDelPhotoId(null)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (delPhotoId && currentDay)
                  actions.deleteEntry(currentDay, delPhotoId);
                setDelPhotoId(null);
                setLightboxPhoto(null);
              }}
            >
              Delete Photo
            </Btn>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete this photo? This cannot be undone.
        </p>
      </Modal>

      <Lightbox
        src={lightboxPhoto?.image ?? null}
        onClose={() => setLightboxPhoto(null)}
        onDelete={
          lightboxPhoto ? () => setDelPhotoId(lightboxPhoto.id) : undefined
        }
      />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// ── MODALS ─────────────────────────────────────────────────────────────────

function NewDayModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (date: string, notes: string) => void;
}) {
  const [date, setDate] = React.useState(todayISO());
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setDate(todayISO());
      setNotes("");
    }
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Trading Day"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => date && onCreate(date, notes.trim())}>
            Create
          </Btn>
        </>
      }
    >
      <Field label="Date">
        <input
          type="date"
          className={inputCls}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="Session notes (optional)">
        <textarea
          className={textareaCls}
          placeholder="Market context, bias, key levels to watch..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

function EditDayModal({
  open,
  onClose,
  date,
  notes,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  notes: string;
  onSave: (newDate: string, notes: string) => void;
}) {
  const [d, setD] = React.useState(date);
  const [n, setN] = React.useState(notes);
  React.useEffect(() => {
    if (open) {
      setD(date);
      setN(notes);
    }
  }, [open, date, notes]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Trading Day"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onSave(d, n.trim())}>
            Save
          </Btn>
        </>
      }
    >
      <Field label="Date">
        <input
          type="date"
          className={inputCls}
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </Field>
      <Field label="Session notes">
        <textarea
          className={textareaCls}
          value={n}
          onChange={(e) => setN(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

function TradeModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (t: Trade) => void;
}) {
  const [time, setTime] = React.useState("");
  const [direction, setDirection] = React.useState<"long" | "short" | null>(null);
  const [pnl, setPnl] = React.useState("");
  const [comm, setComm] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      );
      setDirection(null);
      setPnl("");
      setComm("");
      setNotes("");
    }
  }, [open]);

  const submit = () => {
    const pnlNum = pnl.trim() === "" ? null : parseFloat(pnl);
    const commNum = comm.trim() === "" ? null : parseFloat(comm);
    const net = (pnlNum ?? 0) - (commNum ?? 0);
    const outcome: Trade["outcome"] =
      pnlNum === null ? null : net > 0 ? "win" : net < 0 ? "loss" : "breakeven";
    onSave({
      id: uid(),
      type: "position",
      time,
      direction,
      outcome,
      pnl: pnlNum,
      commissions: commNum,
      notes: notes.trim(),
      created: new Date().toISOString(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Position"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit}>
            Save
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry time">
          <input
            className={inputCls + " num"}
            placeholder="14:30"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <Field label="Direction">
          <div className="flex gap-2">
            {(["long", "short"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium uppercase transition-colors ${
                  direction === d
                    ? d === "long"
                      ? "border-long bg-long/10 text-long"
                      : "border-short bg-short/10 text-short"
                    : "border-border text-muted-foreground hover:bg-surface-2"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="P&L (USD)">
          <input
            className={inputCls + " num"}
            placeholder="312.50 or -150"
            value={pnl}
            onChange={(e) => setPnl(e.target.value)}
          />
        </Field>
        <Field label="Commissions (USD)">
          <input
            className={inputCls + " num"}
            placeholder="4.20"
            value={comm}
            onChange={(e) => setComm(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea
          className={textareaCls}
          placeholder="Quick note..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

function PhotoModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: string | null;
  onSave: (image: string, caption: string) => void;
}) {
  const [image, setImage] = React.useState<string | null>(initial);
  const [caption, setCaption] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setImage(initial);
      setCaption("");
    }
  }, [open, initial]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Photo"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            disabled={!image}
            onClick={() => image && onSave(image, caption.trim())}
          >
            Save Photo
          </Btn>
        </>
      }
    >
      <Field label="Screenshot">
        {image ? (
          <div className="space-y-2">
            <img
              src={image}
              alt=""
              className="max-h-56 w-full rounded-md border border-border bg-surface-2 object-contain"
            />
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setImage(null)}
            >
              Replace
            </button>
          </div>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-8 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f?.type.startsWith("image/")) setImage(await readImage(f));
            }}
          >
            <ImagePlus size={24} />
            <p className="text-xs">
              Drop, click, or paste (
              <kbd className="rounded border border-border bg-surface-2 px-1 text-[10px]">
                Ctrl+V
              </kbd>
              )
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImage(await readImage(f));
              }}
            />
          </div>
        )}
      </Field>
      <Field label="Caption (optional)">
        <input
          className={inputCls}
          placeholder="e.g. 09:45 overview"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

function ViewTradeModal({
  trade,
  onClose,
  onDelete,
}: {
  trade: Trade | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  if (!trade) return null;
  const net = (trade.pnl ?? 0) - (trade.commissions ?? 0);
  return (
    <Modal
      open={!!trade}
      onClose={onClose}
      title={`${trade.time || "--:--"} · ${trade.direction?.toUpperCase() ?? "Position"}`}
      width={520}
      footer={
        <>
          <Btn variant="danger" onClick={onDelete}>
            <Trash2 size={13} /> Delete
          </Btn>
          <Btn onClick={onClose}>Close</Btn>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
        {trade.direction && (
          <Meta
            k="Direction"
            v={
              <span
                className={
                  trade.direction === "long" ? "text-long" : "text-short"
                }
              >
                {trade.direction.toUpperCase()}
              </span>
            }
          />
        )}
        {trade.outcome && (
          <Meta
            k="Outcome"
            v={
              <span
                className={
                  trade.outcome === "win"
                    ? "text-win"
                    : trade.outcome === "loss"
                    ? "text-loss"
                    : "text-be"
                }
              >
                {trade.outcome.toUpperCase()}
              </span>
            }
          />
        )}
        {trade.pnl !== null && (
          <>
            <Meta
              k="Gross"
              v={
                <span
                  className={`num ${trade.pnl >= 0 ? "text-win" : "text-loss"}`}
                >
                  {formatMoney(trade.pnl)}
                </span>
              }
            />
            {trade.commissions ? (
              <Meta
                k="Comm"
                v={
                  <span className="num text-loss">
                    -${trade.commissions.toFixed(2)}
                  </span>
                }
              />
            ) : null}
            <Meta
              k="Net"
              v={
                <span
                  className={`num font-semibold ${net >= 0 ? "text-win" : "text-loss"}`}
                >
                  {formatMoney(net)}
                </span>
              }
            />
          </>
        )}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {trade.notes || (
          <span className="italic opacity-60">No notes.</span>
        )}
      </div>
    </Modal>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {k}
      </span>
      <span className="text-sm">{v}</span>
    </div>
  );
}
