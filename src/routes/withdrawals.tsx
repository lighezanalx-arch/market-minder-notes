import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { actions, formatMoney, uid, useDB } from "@/lib/store";
import { Btn, Field, Modal, inputCls, textareaCls } from "@/components/ui-kit";

export const Route = createFileRoute("/withdrawals")({
  component: WithdrawalsPage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function WithdrawalsPage() {
  const db = useDB();
  const [open, setOpen] = React.useState(false);
  const [delId, setDelId] = React.useState<string | null>(null);

  const list = [...db.withdrawals].sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );
  const total = list.reduce((s, w) => s + w.amount + w.commissions, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex-1">
          <h1 className="text-base font-semibold">Withdrawals</h1>
          <p className="num text-xs text-muted-foreground">
            {list.length} withdrawal{list.length !== 1 && "s"} · total{" "}
            <span className="text-loss">-${total.toFixed(2)}</span>
          </p>
        </div>
        <Btn variant="primary" onClick={() => setOpen(true)}>
          <Plus size={13} /> New Withdrawal
        </Btn>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No withdrawals recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Commissions</th>
                  <th className="px-3 py-2 font-medium">Total Out</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-border last:border-0 hover:bg-surface-2"
                  >
                    <td className="num px-3 py-2">{w.date}</td>
                    <td className="num px-3 py-2 text-loss">
                      -${w.amount.toFixed(2)}
                    </td>
                    <td className="num px-3 py-2 text-loss/80">
                      {w.commissions
                        ? `-$${w.commissions.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="num px-3 py-2 font-semibold text-loss">
                      -${(w.amount + w.commissions).toFixed(2)}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-xs text-muted-foreground">
                      {w.note || ""}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => setDelId(w.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-loss/10 hover:text-loss"
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewWithdrawalModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={(w) => {
          actions.addWithdrawal(w);
          setOpen(false);
        }}
      />

      <Modal
        open={!!delId}
        onClose={() => setDelId(null)}
        title="Delete Withdrawal"
        danger
        footer={
          <>
            <Btn onClick={() => setDelId(null)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (delId) actions.deleteWithdrawal(delId);
                setDelId(null);
              }}
            >
              Delete
            </Btn>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete this withdrawal? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function NewWithdrawalModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (w: ReturnType<typeof build>) => void;
}) {
  const [date, setDate] = React.useState(todayISO());
  const [amount, setAmount] = React.useState("");
  const [comm, setComm] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setDate(todayISO());
      setAmount("");
      setComm("");
      setNote("");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Withdrawal"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            disabled={!amount || !date}
            onClick={() =>
              onSave(
                build({
                  date,
                  amount: parseFloat(amount) || 0,
                  commissions: parseFloat(comm) || 0,
                  note: note.trim(),
                }),
              )
            }
          >
            Save
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input
            type="date"
            className={inputCls}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Amount (USD)">
          <input
            className={inputCls + " num"}
            placeholder="500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Commissions / fees (USD)">
        <input
          className={inputCls + " num"}
          placeholder="e.g. 25 wire fee"
          value={comm}
          onChange={(e) => setComm(e.target.value)}
        />
      </Field>
      <Field label="Note (optional)">
        <textarea
          className={textareaCls}
          placeholder="Bank, reason..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {(amount || comm) && (
        <div className="num rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          Total leaving balance:{" "}
          <span className="font-semibold text-loss">
            {formatMoney(-((parseFloat(amount) || 0) + (parseFloat(comm) || 0)))}
          </span>
        </div>
      )}
    </Modal>
  );
}

function build(w: {
  date: string;
  amount: number;
  commissions: number;
  note: string;
}) {
  return { id: uid(), ...w };
}
