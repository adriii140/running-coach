"use client";

import { useState, useRef, useEffect } from "react";
import {
  Target, Plus, Pencil, Check, X, Trash2, ChevronDown, ChevronUp,
  Calendar, Clock, MoreVertical, Flag,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoalItem {
  id: string;
  name: string;
  type: string;
  targetDate: string;
  distanceKm: number | null;
  targetTimeSec: number | null;
  priority: number;
  status: string;
  notes: string | null;
}

export interface BestTimes {
  best5kSec: number | null;
  best10kSec: number | null;
  bestHalfSec: number | null;
  bestMarathonSec: number | null;
}

interface GoalsListProps {
  initialGoals: GoalItem[];
  bestTimes: BestTimes;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  FIVE_K: "5K",
  TEN_K: "10K",
  HALF_MARATHON: "Media maratón",
  MARATHON: "Maratón",
  ULTRA: "Ultra",
  RELAY: "Relevos",
  CUSTOM: "Personalizado",
};

const TYPE_EMOJIS: Record<string, string> = {
  FIVE_K: "🏃",
  TEN_K: "⚡",
  HALF_MARATHON: "🥈",
  MARATHON: "🏆",
  ULTRA: "🏔️",
  RELAY: "🤝",
  CUSTOM: "🎯",
};

const TYPE_BEST_TIME_KEY: Record<string, keyof BestTimes | null> = {
  FIVE_K: "best5kSec",
  TEN_K: "best10kSec",
  HALF_MARATHON: "bestHalfSec",
  MARATHON: "bestMarathonSec",
  ULTRA: null,
  RELAY: null,
  CUSTOM: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseTimeInput(val: string): number | null {
  const parts = val.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function timeToInput(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DaysChip({ days }: { days: number }) {
  if (days < 0)
    return <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Pasado</span>;
  if (days === 0)
    return <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">¡Hoy!</span>;
  if (days <= 30)
    return <span className="text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">{days}d</span>;
  if (days <= 90)
    return <span className="text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">{days}d</span>;
  return <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{days}d</span>;
}

function ProgressBar({ goal, bestTimes }: { goal: GoalItem; bestTimes: BestTimes }) {
  const key = TYPE_BEST_TIME_KEY[goal.type];
  if (!key || !goal.targetTimeSec) return null;
  const best = bestTimes[key];
  if (!best) return null;

  // % gap: how much faster target is vs current best
  const gap = ((best - goal.targetTimeSec) / best) * 100;
  const pct = Math.max(0, Math.min(100, 100 - Math.abs(gap)));

  const label =
    gap <= 0
      ? `¡Meta alcanzada! (${formatTime(goal.targetTimeSec)})`
      : `${gap.toFixed(1)}% más rápido que tu marca actual (${formatTime(best)})`;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Action menu (mobile-friendly) ───────────────────────────────────────────

function ActionMenu({
  onEdit,
  onComplete,
  onCancel,
  onDelete,
}: {
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Desktop: icon row (hover reveal) */}
      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          title="Editar"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onComplete}
          title="Completar"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-400/10 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCancel}
          title="Cancelar objetivo"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Eliminar"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mobile: ⋮ menu */}
      <div className="sm:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-8 z-50 min-w-[150px] rounded-xl border border-border bg-card shadow-lg py-1">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              onClick={() => { setOpen(false); onComplete(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-green-400/10 transition-colors"
            >
              <Check className="h-3.5 w-3.5" /> Completar
            </button>
            <button
              onClick={() => { setOpen(false); onCancel(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  bestTimes,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  goal: GoalItem;
  bestTimes: BestTimes;
  onEdit: (g: GoalItem) => void;
  onStatusChange: (id: string, status: "COMPLETED" | "CANCELLED") => void;
  onDelete: (id: string) => void;
}) {
  const days = daysUntil(goal.targetDate);
  const emoji = TYPE_EMOJIS[goal.type] ?? "🎯";
  const typeLabel = TYPE_LABELS[goal.type] ?? goal.type;

  return (
    <div className="group relative flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/40 hover:border-border hover:bg-card/70 p-4 transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl leading-none mt-0.5 shrink-0">{emoji}</span>
          <div className="min-w-0">
            <p className="font-semibold truncate">{goal.name}</p>
            <span className="text-xs text-muted-foreground">{typeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <DaysChip days={days} />
          <ActionMenu
            onEdit={() => onEdit(goal)}
            onComplete={() => onStatusChange(goal.id, "COMPLETED")}
            onCancel={() => onStatusChange(goal.id, "CANCELLED")}
            onDelete={() => onDelete(goal.id)}
          />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(goal.targetDate)}
        </span>
        {goal.distanceKm && (
          <span className="flex items-center gap-1">
            <Flag className="h-3 w-3" />
            {goal.distanceKm} km
          </span>
        )}
        {goal.targetTimeSec && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Objetivo: {formatTime(goal.targetTimeSec)}
          </span>
        )}
      </div>

      {/* Notes */}
      {goal.notes && (
        <p className="text-xs text-muted-foreground/80 line-clamp-2">{goal.notes}</p>
      )}

      {/* Progress bar */}
      <ProgressBar goal={goal} bestTimes={bestTimes} />
    </div>
  );
}

// ─── Goal Form Modal ──────────────────────────────────────────────────────────

interface GoalFormValues {
  name: string;
  type: string;
  targetDate: string;
  distanceKm: string;
  targetTime: string;
  notes: string;
}

function GoalFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: GoalItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<GoalFormValues>({
    name: initial?.name ?? "",
    type: initial?.type ?? "MARATHON",
    targetDate: initial?.targetDate ? initial.targetDate.slice(0, 10) : "",
    distanceKm: initial?.distanceKm ? String(initial.distanceKm) : "",
    targetTime: initial?.targetTimeSec ? timeToInput(initial.targetTimeSec) : "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.type || !form.targetDate) {
      setError("Nombre, tipo y fecha son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");

    const targetTimeSec = form.targetTime ? parseTimeInput(form.targetTime) : null;

    const payload = {
      name: form.name.trim(),
      type: form.type,
      targetDate: form.targetDate,
      distanceKm: form.distanceKm ? parseFloat(form.distanceKm) : undefined,
      targetTimeSec: targetTimeSec ?? undefined,
      notes: form.notes || undefined,
    };

    try {
      const res = initial
        ? await fetch("/api/goals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: initial.id, ...payload }),
          })
        : await fetch("/api/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al guardar");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Error de red");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">
            {initial ? "Editar objetivo" : "Nuevo objetivo"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ej. Sub-4h en Maratón Valencia"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {TYPE_EMOJIS[v]} {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Fecha objetivo</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Distancia (km) <span className="text-muted-foreground font-normal">opcional</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.distanceKm}
                onChange={(e) => setForm((f) => ({ ...f, distanceKm: e.target.value }))}
                placeholder="ej. 42.2"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Tiempo <span className="text-muted-foreground font-normal">MM:SS o HH:MM:SS</span>
              </label>
              <input
                type="text"
                value={form.targetTime}
                onChange={(e) => setForm((f) => ({ ...f, targetTime: e.target.value }))}
                placeholder="ej. 3:55:00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notas <span className="text-muted-foreground font-normal">opcional</span>
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Motivación, estrategia, contexto..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear objetivo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GoalsList({ initialGoals, bestTimes }: GoalsListProps) {
  const [goals, setGoals] = useState<GoalItem[]>(initialGoals);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const refresh = () => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data) => {
        if (data.goals) setGoals(data.goals);
      });
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingGoal(null);
    refresh();
  };

  const handleStatusChange = async (id: string, status: "COMPLETED" | "CANCELLED") => {
    const label = status === "COMPLETED" ? "completar" : "cancelar";
    if (!confirm(`¿Quieres ${label} este objetivo?`)) return;
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este objetivo permanentemente?")) return;
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const active = goals
    .filter((g) => g.status === "ACTIVE")
    .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());

  const history = goals
    .filter((g) => g.status !== "ACTIVE")
    .sort((a, b) => new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime());

  return (
    <>
      {(showForm || editingGoal) && (
        <GoalFormModal
          initial={editingGoal ?? undefined}
          onClose={() => { setShowForm(false); setEditingGoal(null); }}
          onSaved={handleSaved}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Objetivos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {active.length} activo{active.length !== 1 ? "s" : ""} · {history.length} en historial
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo objetivo
          </button>
        </div>

        {/* Active goals */}
        {active.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Activos
            </h2>
            <div className="space-y-3">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  bestTimes={bestTimes}
                  onEdit={setEditingGoal}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <Target className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-medium">Sin objetivos activos</p>
              <p className="text-sm text-muted-foreground mt-1">
                Define una meta para que el coach AI pueda orientar tu entrenamiento hacia ella.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Crear mi primer objetivo
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Historial ({history.length})
            </button>

            {showHistory && (
              <div className="space-y-2 opacity-60">
                {history.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/30 px-4 py-3"
                  >
                    <span className="text-xl">{TYPE_EMOJIS[goal.type] ?? "🎯"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[goal.type] ?? goal.type} · {formatDate(goal.targetDate)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        goal.status === "COMPLETED"
                          ? "text-green-400 bg-green-400/10"
                          : "text-muted-foreground bg-muted"
                      }`}
                    >
                      {goal.status === "COMPLETED" ? "Completado" : "Cancelado"}
                    </span>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
