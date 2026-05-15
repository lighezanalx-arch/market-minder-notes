import * as React from "react";
import { ZoomIn, ZoomOut, Maximize, X, Trash2 } from "lucide-react";

type Props = {
  src: string | null;
  onClose: () => void;
  onDelete?: () => void;
};

export function Lightbox({ src, onClose, onDelete }: Props) {
  const [scale, setScale] = React.useState(1);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [src]);

  React.useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = e.deltaY > 0 ? s * 0.85 : s * 1.18;
        return Math.min(Math.max(next, 0.5), 8);
      });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [src, onClose]);

  React.useEffect(() => {
    if (scale <= 1) setPos({ x: 0, y: 0 });
  }, [scale]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy });
    };
    const onUp = () => (dragRef.current = null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!src) return null;

  const fullscreen = () => {
    const el = wrapRef.current?.parentElement;
    if (!document.fullscreenElement) el?.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/95"
      style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
      onClick={onClose}
    >
      <div
        className="absolute left-3 top-3 z-10 flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <IconBtn onClick={() => setScale((s) => Math.min(s * 1.4, 8))}>
          <ZoomIn size={14} />
        </IconBtn>
        <IconBtn onClick={() => setScale((s) => Math.max(s / 1.4, 0.5))}>
          <ZoomOut size={14} />
        </IconBtn>
        <IconBtn
          onClick={() => {
            setScale(1);
            setPos({ x: 0, y: 0 });
          }}
        >
          Reset
        </IconBtn>
        <IconBtn onClick={fullscreen}>
          <Maximize size={14} />
        </IconBtn>
        {onDelete && (
          <IconBtn onClick={onDelete} danger>
            <Trash2 size={14} /> Delete
          </IconBtn>
        )}
        <IconBtn onClick={onClose}>
          <X size={14} />
        </IconBtn>
      </div>
      <div
        ref={wrapRef}
        className="select-none"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: "center",
          transition: dragRef.current ? "none" : "transform 0.15s",
        }}
        onMouseDown={onMouseDown}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="block max-h-[92vh] max-w-[95vw] object-contain pointer-events-none"
        />
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">
        Scroll to zoom · drag to pan · click outside to close
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded border bg-black/60 px-2.5 py-1 text-xs backdrop-blur transition-colors ${
        danger
          ? "border-loss/50 text-loss hover:bg-loss/10"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
