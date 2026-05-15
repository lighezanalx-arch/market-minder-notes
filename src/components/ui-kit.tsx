import * as React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  danger?: boolean;
};

export function Modal({ open, onClose, title, children, footer, width = 480, danger }: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className={`text-sm font-semibold ${danger ? "text-loss" : ""}`}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary";
export const textareaCls = inputCls + " min-h-20 resize-y leading-relaxed";

export function Btn({
  variant = "ghost",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const styles = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost:
      "border border-border text-foreground hover:bg-surface-2",
    subtle:
      "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
    danger:
      "border border-loss/40 text-loss hover:bg-loss/10",
  } as const;
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}
