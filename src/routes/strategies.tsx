import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  Plus,
  Trash2,
  Pencil,
  ImagePlus,
  Lightbulb,
  Image as ImageIcon,
} from "lucide-react";
import {
  actions,
  uid,
  useDB,
  type Photo,
  type Strategy,
} from "@/lib/store";
import { Btn, Field, Modal, inputCls, textareaCls } from "@/components/ui-kit";
import { Lightbox } from "@/components/Lightbox";

export const Route = createFileRoute("/strategies")({ component: StrategiesPage });

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function StrategiesPage() {
  const db = useDB();
  const [currentId, setCurrentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentId) return;
    if (db.strategies.length) setCurrentId(db.strategies[0].id);
  }, [db.strategies, currentId]);

  const current = db.strategies.find((s) => s.id === currentId) ?? null;

  const [newOpen, setNewOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [pendingPhoto, setPendingPhoto] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<Photo | null>(null);
  const [delPhotoId, setDelPhotoId] = React.useState<string | null>(null);

  // paste
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!current) return;
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
  }, [current]);

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Strategies
          </span>
          <Btn
            variant="primary"
            className="!px-2 !py-1 !text-xs"
            onClick={() => setNewOpen(true)}
          >
            <Plus size={12} /> New
          </Btn>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto py-2">
          {db.strategies.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No strategies yet — add one to get started.
            </div>
          )}
          {db.strategies.map((s) => {
            const active = currentId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentId(s.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Lightbulb size={13} className="shrink-0" />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="num rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {s.photos.length}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden">
        {!current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Lightbulb size={36} className="opacity-30" />
            <p className="text-sm">Select a strategy from the sidebar</p>
            <p className="text-xs opacity-70">or create a new one</p>
          </div>
        ) : (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
              <div className="flex-1">
                <div className="text-base font-semibold">{current.name}</div>
                <div className="num text-xs text-muted-foreground">
                  {current.photos.length} photo
                  {current.photos.length !== 1 && "s"}
                </div>
              </div>
              <Btn onClick={() => setEditOpen(true)}>
                <Pencil size={13} /> Edit
              </Btn>
              <Btn variant="danger" onClick={() => setDelOpen(true)}>
                <Trash2 size={13} /> Delete
              </Btn>
              <Btn
                onClick={() => {
                  setPendingPhoto(null);
                  setPhotoOpen(true);
                }}
              >
                <ImagePlus size={13} /> Photo
              </Btn>
            </header>

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
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </h3>
                {current.notes ? (
                  <div className="whitespace-pre-wrap rounded-md border border-border bg-card px-4 py-3 text-sm leading-relaxed">
                    {current.notes}
                  </div>
                ) : (
                  <p className="py-2 text-xs text-muted-foreground">
                    No notes yet — click Edit to add some.
                  </p>
                )}
              </div>

              <div className="mb-6 rounded-md border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
                Drop a screenshot here · or paste with{" "}
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px]">
                  Ctrl+V
                </kbd>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Photos
                </h3>
                {current.photos.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground">
                    No photos yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {current.photos.map((p) => (
                      <div
                        key={p.id}
                        className="group relative overflow-hidden rounded-md border border-border bg-surface"
                      >
                        <button
                          onClick={() => setLightbox(p)}
                          className="block w-full"
                        >
                          <img
                            src={p.image}
                            alt={p.caption}
                            className="h-40 w-full object-cover"
                          />
                        </button>
                        {p.caption && (
                          <div className="border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
                            {p.caption}
                          </div>
                        )}
                        <button
                          onClick={() => setDelPhotoId(p.id)}
                          className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-loss group-hover:opacity-100"
                          aria-label="Delete photo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* NEW */}
      <StrategyFormModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={({ name, notes }) => {
          const s: Strategy = {
            id: uid(),
            name,
            notes,
            photos: [],
            created: new Date().toISOString(),
          };
          actions.addStrategy(s);
          setCurrentId(s.id);
          setNewOpen(false);
        }}
        title="New Strategy"
      />

      {/* EDIT */}
      {current && (
        <StrategyFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={{ name: current.name, notes: current.notes }}
          onSubmit={({ name, notes }) => {
            actions.updateStrategy(current.id, { name, notes });
            setEditOpen(false);
          }}
          title="Edit Strategy"
        />
      )}

      {/* DELETE STRATEGY */}
      {current && (
        <Modal
          open={delOpen}
          onClose={() => setDelOpen(false)}
          title="Delete strategy?"
          danger
          footer={
            <>
              <Btn onClick={() => setDelOpen(false)}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  actions.deleteStrategy(current.id);
                  setCurrentId(null);
                  setDelOpen(false);
                }}
              >
                Delete
              </Btn>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{current.name}</strong> and all
            its photos.
          </p>
        </Modal>
      )}

      {/* PHOTO */}
      {current && (
        <PhotoModal
          open={photoOpen}
          onClose={() => {
            setPhotoOpen(false);
            setPendingPhoto(null);
          }}
          initialImage={pendingPhoto}
          onSubmit={({ image, caption }) => {
            actions.addStrategyPhoto(current.id, {
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

      {/* DELETE PHOTO */}
      {current && delPhotoId && (
        <Modal
          open
          onClose={() => setDelPhotoId(null)}
          title="Delete photo?"
          danger
          footer={
            <>
              <Btn onClick={() => setDelPhotoId(null)}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  actions.deleteStrategyPhoto(current.id, delPhotoId);
                  setDelPhotoId(null);
                }}
              >
                Delete
              </Btn>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            Remove this photo from <strong>{current.name}</strong>?
          </p>
        </Modal>
      )}

      {lightbox && (
        <Lightbox src={lightbox.image} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function StrategyFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: { name: string; notes: string }) => void;
  initial?: { name: string; notes: string };
  title: string;
}) {
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial?.name, initial?.notes]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (!name.trim()) return;
              onSubmit({ name: name.trim(), notes });
            }}
          >
            Save
          </Btn>
        </>
      }
    >
      <Field label="Name">
        <input
          autoFocus
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Opening Range Breakout"
        />
      </Field>
      <Field label="Notes">
        <textarea
          className={textareaCls}
          rows={8}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Setup, entry rules, exits, invalidations…"
        />
      </Field>
    </Modal>
  );
}

function PhotoModal({
  open,
  onClose,
  onSubmit,
  initialImage,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: { image: string; caption: string }) => void;
  initialImage: string | null;
}) {
  const [image, setImage] = React.useState<string | null>(null);
  const [caption, setCaption] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setImage(initialImage);
      setCaption("");
    }
  }, [open, initialImage]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add photo"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (!image) return;
              onSubmit({ image, caption });
            }}
          >
            Add
          </Btn>
        </>
      }
    >
      <Field label="Image">
        {image ? (
          <div className="relative">
            <img
              src={image}
              alt=""
              className="max-h-72 w-full rounded-md border border-border object-contain"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white hover:bg-loss"
              aria-label="Remove"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-8 text-xs text-muted-foreground hover:bg-surface-2">
            <ImageIcon size={20} />
            <span>Click to choose · or paste with Ctrl+V</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImage(await readImage(f));
              }}
            />
          </label>
        )}
      </Field>
      <Field label="Caption (optional)">
        <input
          className={inputCls}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Describe this screenshot…"
        />
      </Field>
    </Modal>
  );
}
