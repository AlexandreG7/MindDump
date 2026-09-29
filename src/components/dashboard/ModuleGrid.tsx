"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MODULE_LABELS,
  MODULE_SIZES,
  SIZE_LABELS,
  type ModuleId,
  type ModuleSize,
  type ModuleSlot,
} from "@/lib/dashboardLayout";

/** Colonnes occupées : 2 colonnes sur tablette, 6 sur grand écran ; une seule sur téléphone. */
const SPAN_CLASS: Record<ModuleSize, string> = {
  S: "md:col-span-1 lg:col-span-2",
  M: "md:col-span-1 lg:col-span-3",
  L: "md:col-span-2 lg:col-span-4",
  XL: "md:col-span-2 lg:col-span-6",
};

// Grille « maçonnée » : lignes de 8 px, chaque module s'étend sur autant de
// lignes que sa hauteur réelle. Les petits modules comblent ainsi les trous à
// côté d'un grand, au lieu de s'aligner sur la ligne la plus haute.
const ROW_PX = 8;
const GAP_PX = 24;

function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

export function ModuleGrid({
  layout,
  available,
  editing,
  renderModule,
  onChange,
}: {
  layout: ModuleSlot[];
  /** Modules dont la fonctionnalité est active (les autres ne sont jamais montrés). */
  available: Set<ModuleId>;
  editing: boolean;
  renderModule: (id: ModuleId) => React.ReactNode;
  onChange: (layout: ModuleSlot[]) => void;
}) {
  const wide = useIsWide();
  const [spans, setSpans] = useState<Record<string, number>>({});
  const [dragId, setDragId] = useState<ModuleId | null>(null);
  const [overId, setOverId] = useState<ModuleId | null>(null);
  const items = useRef(new Map<ModuleId, HTMLDivElement>());

  const shown = layout.filter((s) => s.visible && available.has(s.id));
  const hidden = layout.filter((s) => !s.visible && available.has(s.id));

  const measure = useCallback(() => {
    const next: Record<string, number> = {};
    items.current.forEach((el, id) => {
      next[id] = Math.ceil((el.getBoundingClientRect().height + GAP_PX) / ROW_PX);
    });
    setSpans((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    if (!wide) return;
    measure();
    const ro = new ResizeObserver(measure);
    items.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [wide, measure, shown.length, editing, layout]);

  const update = (id: ModuleId, patch: Partial<ModuleSlot>) =>
    onChange(layout.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** Déplace un module avant ou après son voisin visible. */
  const step = (id: ModuleId, dir: -1 | 1) => {
    const order = shown.map((s) => s.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    moveTo(id, order[j]);
  };

  /** Place `id` à l'emplacement de `target` dans la disposition complète. */
  const moveTo = (id: ModuleId, target: ModuleId) => {
    if (id === target) return;
    const from = layout.findIndex((s) => s.id === id);
    const to = layout.findIndex((s) => s.id === target);
    const next = [...layout];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-6",
          wide && "grid-flow-row-dense gap-y-0"
        )}
        style={wide ? { gridAutoRows: `${ROW_PX}px` } : undefined}
      >
        {shown.map((slot, index) => (
          <div
            key={slot.id}
            className={cn(SPAN_CLASS[slot.size], "min-w-0")}
            style={wide && spans[slot.id] ? { gridRowEnd: `span ${spans[slot.id]}` } : undefined}
            onDragOver={
              editing
                ? (e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    if (overId !== slot.id) setOverId(slot.id);
                  }
                : undefined
            }
            onDrop={
              editing
                ? (e) => {
                    e.preventDefault();
                    if (dragId) moveTo(dragId, slot.id);
                    setDragId(null);
                    setOverId(null);
                  }
                : undefined
            }
          >
            <div
              ref={(el) => {
                if (el) items.current.set(slot.id, el);
                else items.current.delete(slot.id);
              }}
            >
              {editing ? (
                <div
                  className={cn(
                    "rounded-2xl border-2 border-dashed p-2 transition-colors",
                    overId === slot.id && dragId !== slot.id ? "border-primary bg-primary/5" : "border-border",
                    dragId === slot.id && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-1 px-1 pb-1">
                    <span
                      draggable
                      onDragStart={(e) => {
                        setDragId(slot.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", slot.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverId(null);
                      }}
                      className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-secondary"
                      title="Glisser pour déplacer"
                      aria-hidden="true"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium truncate flex-1 min-w-0 pl-1 md:pl-0">
                      {MODULE_LABELS[slot.id]}
                    </span>
                    <IconButton
                      label={`Monter ${MODULE_LABELS[slot.id]}`}
                      disabled={index === 0}
                      onClick={() => step(slot.id, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={`Descendre ${MODULE_LABELS[slot.id]}`}
                      disabled={index === shown.length - 1}
                      onClick={() => step(slot.id, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={`Masquer ${MODULE_LABELS[slot.id]}`} onClick={() => update(slot.id, { visible: false })}>
                      <EyeOff className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`Largeur du module ${MODULE_LABELS[slot.id]}`}
                    className="hidden md:flex w-fit items-center rounded-lg bg-secondary p-0.5 mx-1 mb-2"
                  >
                    {MODULE_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        role="radio"
                        aria-checked={slot.size === size}
                        aria-label={SIZE_LABELS[size].long}
                        title={SIZE_LABELS[size].long}
                        onClick={() => update(slot.id, { size })}
                        className={cn(
                          "h-7 min-w-[2.25rem] px-1.5 rounded-md text-xs tabular-nums transition-colors",
                          slot.size === size
                            ? "bg-card text-foreground font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {SIZE_LABELS[size].short}
                      </button>
                    ))}
                  </div>

                  {/* Aperçu non cliquable : on dispose, on n'utilise pas. */}
                  <div
                    ref={(el) => el?.setAttribute("inert", "")}
                    className="pointer-events-none select-none"
                  >
                    {renderModule(slot.id)}
                  </div>
                </div>
              ) : (
                renderModule(slot.id)
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="rounded-2xl border-2 border-dashed border-border px-4 py-3">
          <p className="text-sm font-medium">Modules masqués</p>
          {hidden.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">Tous les modules sont affichés.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {hidden.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => update(slot.id, { visible: true })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 h-8 touch:h-10 text-sm hover:bg-secondary"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {MODULE_LABELS[slot.id]}
                  <span className="sr-only"> : afficher</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 touch:h-10 touch:w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
