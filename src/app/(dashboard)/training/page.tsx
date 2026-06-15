"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Loader2, CalendarDays, BarChart3,
  X, Edit3, Mountain, Timer, Zap, MapPin, Info, RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlannedSession {
  id: string;
  weekNumber: number;
  date: string;
  type: string;
  distanceKm: number | null;
  durationMin: number | null;
  targetPaceSec: number | null;
  elevationM: number | null;
  zone: string | null;
  description: string | null;
  notes: string | null;
  completed: boolean;
  skipped: boolean;
}

interface TrainingPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  aiGenerated: boolean;
  sessions: PlannedSession[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  EASY:           { bg: "bg-green-500/10",   text: "text-green-400",   border: "border-green-500/30",  dot: "bg-green-400" },
  LONG:           { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/30",   dot: "bg-blue-400" },
  TEMPO:          { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/30", dot: "bg-orange-400" },
  INTERVALS:      { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30",    dot: "bg-red-400" },
  RECOVERY:       { bg: "bg-purple-500/10",  text: "text-purple-400",  border: "border-purple-500/30", dot: "bg-purple-400" },
  RACE:           { bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/30", dot: "bg-yellow-400" },
  STRENGTH:       { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "border-cyan-500/30",   dot: "bg-cyan-400" },
  CROSS_TRAINING: { bg: "bg-teal-500/10",    text: "text-teal-400",    border: "border-teal-500/30",   dot: "bg-teal-400" },
  REST:           { bg: "bg-muted/20",       text: "text-muted-foreground", border: "border-border",   dot: "bg-muted-foreground" },
};

const SESSION_LABELS: Record<string, string> = {
  EASY: "Rodaje fácil", LONG: "Tirada larga", TEMPO: "Tempo",
  INTERVALS: "Series", RECOVERY: "Recuperación", RACE: "Carrera",
  STRENGTH: "Fuerza", CROSS_TRAINING: "Entreno cruzado", REST: "Descanso",
};

const SESSION_ICONS: Record<string, string> = {
  EASY: "🏃", LONG: "🛤️", TEMPO: "💨", INTERVALS: "⚡",
  RECOVERY: "🧘", RACE: "🏁", STRENGTH: "💪", CROSS_TRAINING: "🚴", REST: "😴",
};

const DAY_NAMES_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES_FULL  = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function getWeekDates(plan: TrainingPlan, weekNum: number): Date[] {
  const start = new Date(plan.startDate);
  const weekStart = new Date(start.getTime() + (weekNum - 1) * 7 * 24 * 3600 * 1000);
  return Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 24 * 3600 * 1000));
}

function getWeekGrid(sessions: PlannedSession[], plan: TrainingPlan, weekNum: number): (PlannedSession | null)[] {
  const dates = getWeekDates(plan, weekNum);
  return dates.map(date => {
    const iso = date.toISOString().split("T")[0];
    return sessions.find(s => s.date.startsWith(iso)) ?? null;
  });
}

function totalWeeks(plan: TrainingPlan): number {
  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)));
}

function weekStats(sessions: PlannedSession[], weekNum: number) {
  const w = sessions.filter(s => s.weekNumber === weekNum);
  const km = w.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
  const done = w.filter(s => s.completed).length;
  const skipped = w.filter(s => s.skipped).length;
  return { km: km.toFixed(0), done, skipped, total: w.length };
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr.startsWith(today);
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────

function SessionDetailModal({
  session,
  onClose,
  onAction,
  onSaveNotes,
}: {
  session: PlannedSession;
  onClose: () => void;
  onAction: (id: string, action: "complete" | "skip" | "reset") => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(session.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const colors = SESSION_COLORS[session.type] ?? SESSION_COLORS.EASY;
  const label = SESSION_LABELS[session.type] ?? session.type;
  const icon = SESSION_ICONS[session.type] ?? "🏃";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-border`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <p className={`text-lg font-bold ${colors.text}`}>{label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(session.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {session.distanceKm && (
            <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin className="h-3.5 w-3.5" /> Distancia
              </div>
              <p className="text-xl font-bold">{session.distanceKm} <span className="text-sm font-normal">km</span></p>
            </div>
          )}
          {session.durationMin && (
            <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Timer className="h-3.5 w-3.5" /> Duración
              </div>
              <p className="text-xl font-bold">{session.durationMin} <span className="text-sm font-normal">min</span></p>
            </div>
          )}
          {session.elevationM && (
            <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Mountain className="h-3.5 w-3.5" /> Desnivel
              </div>
              <p className="text-xl font-bold">{session.elevationM} <span className="text-sm font-normal">m D+</span></p>
            </div>
          )}
          {session.zone && (
            <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Zap className="h-3.5 w-3.5" /> Zona
              </div>
              <p className="text-xl font-bold">{session.zone}</p>
            </div>
          )}
          {session.targetPaceSec && (
            <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3 col-span-2`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" /> Ritmo objetivo
              </div>
              <p className="text-xl font-bold">{formatPace(session.targetPaceSec)}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {session.description && (
          <div className="mx-5 mb-4 rounded-xl bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> Descripción del coach
            </p>
            <p className="text-sm leading-relaxed">{session.description}</p>
          </div>
        )}

        {/* Personal notes */}
        <div className="mx-5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tus notas</p>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Edit3 className="h-3 w-3" /> Editar
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Cómo fue la sesión, sensaciones, ajustes..."
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { onSaveNotes(session.id, notes); setEditingNotes(false); }}
                  className="flex-1 rounded-lg bg-primary py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Guardar
                </button>
                <button
                  onClick={() => { setNotes(session.notes ?? ""); setEditingNotes(false); }}
                  className="flex-1 rounded-lg border border-border py-1.5 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {notes || "Sin notas todavía"}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex gap-3">
          {!session.completed && !session.skipped && (
            <>
              <button
                onClick={() => { onAction(session.id, "complete"); onClose(); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500/20 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/30"
              >
                <CheckCircle2 className="h-4 w-4" /> Completada
              </button>
              <button
                onClick={() => { onAction(session.id, "skip"); onClose(); }}
                className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <XCircle className="h-4 w-4" /> Saltada
              </button>
            </>
          )}
          {(session.completed || session.skipped) && (
            <button
              onClick={() => { onAction(session.id, "reset"); onClose(); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" /> Deshacer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generate Plan Modal ───────────────────────────────────────────────────────

function GeneratePlanModal({ onClose, onGenerated }: {
  onClose: () => void;
  onGenerated: (plan: TrainingPlan) => void;
}) {
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [currentWeeklyKm, setCurrentWeeklyKm] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setProgress("Analizando tus datos de entrenamiento...");
    try {
      const res = await fetch("/api/training-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ai",
          startDate,
          daysPerWeek,
          currentWeeklyKm: currentWeeklyKm ? Number(currentWeeklyKm) : undefined,
          notes: notes || undefined,
        }),
      });
      setProgress("El coach está diseñando tu plan...");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error generando el plan");
      }
      const plan = await res.json();
      onGenerated(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="p-5">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Nuevo plan con Coach IA</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Fecha de inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Días de entreno por semana</label>
              <div className="flex gap-2">
                {[3, 4, 5, 6].map(d => (
                  <button
                    key={d}
                    onClick={() => setDaysPerWeek(d)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      daysPerWeek === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Km/semana actuales <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                type="number"
                placeholder="Ej: 40"
                value={currentWeeklyKm}
                onChange={e => setCurrentWeeklyKm(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Notas para el coach <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <textarea
                placeholder="Ej: Tengo maratón en 12 semanas, suelo lesionarme la rodilla..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-400">{error}</p>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background py-3 text-sm font-medium hover:bg-muted/50"
            >
              Cancelar
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">{progress || "Generando..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generar plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini session chip (for grid) ──────────────────────────────────────────────

function SessionChip({
  session,
  dayName,
  date,
  onClick,
}: {
  session: PlannedSession;
  dayName: string;
  date: Date;
  onClick: () => void;
}) {
  const colors = SESSION_COLORS[session.type] ?? SESSION_COLORS.EASY;
  const icon = SESSION_ICONS[session.type] ?? "🏃";
  const todayMark = isToday(session.date);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-2 text-left transition-all hover:scale-[1.02] active:scale-95 ${
        session.completed ? "opacity-60 border-green-500/30 bg-green-500/5" :
        session.skipped   ? "opacity-40 border-border bg-muted/10" :
        `${colors.bg} ${colors.border}`
      } ${todayMark ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-base leading-none">{icon}</span>
        {session.completed && <CheckCircle2 className="h-3 w-3 text-green-400" />}
        {session.skipped   && <XCircle      className="h-3 w-3 text-muted-foreground" />}
        {todayMark && !session.completed && !session.skipped && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </div>
      {session.distanceKm && (
        <p className={`text-xs font-bold leading-tight ${colors.text}`}>{session.distanceKm}km</p>
      )}
      {!session.distanceKm && session.durationMin && (
        <p className={`text-xs font-bold leading-tight ${colors.text}`}>{session.durationMin}m</p>
      )}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PlannedSession | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/training-plan");
      if (!res.ok) return;
      const data = await res.json();
      setPlans(data.plans ?? []);
      const active = data.plans?.find((p: TrainingPlan) => p.status === "ACTIVE");
      if (active) {
        setActivePlan(active);
        const start = new Date(active.startDate);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
        setCurrentWeek(Math.max(1, Math.min(elapsed + 1, totalWeeks(active))));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  async function handleSessionAction(sessionId: string, action: "complete" | "skip" | "reset") {
    await fetch("/api/training-plan/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action }),
    });
    setActivePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === sessionId
            ? { ...s, completed: action === "complete", skipped: action === "skip" }
            : s
        ),
      };
    });
    // Update selected session too
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? {
        ...prev,
        completed: action === "complete",
        skipped: action === "skip",
      } : prev);
    }
  }

  async function handleSaveNotes(sessionId: string, notes: string) {
    await fetch("/api/training-plan/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "notes", notes }),
    });
    setActivePlan(prev => {
      if (!prev) return prev;
      return { ...prev, sessions: prev.sessions.map(s => s.id === sessionId ? { ...s, notes } : s) };
    });
  }

  async function deletePlan(id: string) {
    setDeletingPlan(id);
    await fetch(`/api/training-plan?id=${id}`, { method: "DELETE" });
    await loadPlans();
    setDeletingPlan(null);
  }

  async function switchPlanStatus(id: string, status: "ACTIVE" | "PAUSED") {
    await fetch("/api/training-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await loadPlans();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const weeks = activePlan ? totalWeeks(activePlan) : 0;
  const grid = activePlan ? getWeekGrid(activePlan.sessions, activePlan, currentWeek) : [];
  const weekDates = activePlan ? getWeekDates(activePlan, currentWeek) : [];
  const stats = activePlan ? weekStats(activePlan.sessions, currentWeek) : null;
  const totalCompleted = activePlan?.sessions.filter(s => s.completed).length ?? 0;
  const totalSessions = activePlan?.sessions.length ?? 0;
  const overallPct = totalSessions > 0 ? Math.round((totalCompleted / totalSessions) * 100) : 0;

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de entreno</h1>
          <p className="text-sm text-muted-foreground">
            {activePlan ? activePlan.name : "Sin plan activo"}
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo plan IA</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Empty state */}
      {!activePlan && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="text-lg font-semibold">Sin plan activo</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Genera un plan personalizado con IA basado en tus datos de entrenamiento
            </p>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            Generar mi plan
          </button>
        </div>
      )}

      {/* Active plan */}
      {activePlan && (
        <div className="space-y-4">
          {/* Overall progress */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Progreso total</p>
              <p className="text-sm font-bold text-primary">{overallPct}%</p>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {totalCompleted} de {totalSessions} sesiones completadas · {weeks} semanas
            </p>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
              disabled={currentWeek === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted disabled:opacity-30 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">Semana {currentWeek} de {weeks}</p>
              {stats && (
                <p className="text-xs text-muted-foreground">
                  {stats.km} km · {stats.done}/{stats.total} hechas
                  {stats.skipped > 0 && ` · ${stats.skipped} saltadas`}
                </p>
              )}
            </div>
            <button
              onClick={() => setCurrentWeek(w => Math.min(weeks, w + 1))}
              disabled={currentWeek === weeks}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted disabled:opacity-30 shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* ── DESKTOP: 7-column grid ── */}
          <div className="hidden sm:grid grid-cols-7 gap-2">
            {DAY_NAMES_SHORT.map((day, i) => {
              const date = weekDates[i];
              const todayMark = date ? isToday(date.toISOString()) : false;
              return (
                <div key={day}>
                  <p className={`mb-1.5 text-center text-xs font-medium ${todayMark ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {day}
                    {date && (
                      <span className="block text-[10px]">
                        {date.getDate()}/{date.getMonth() + 1}
                      </span>
                    )}
                  </p>
                  {grid[i] ? (
                    <SessionChip
                      session={grid[i]!}
                      dayName={DAY_NAMES_FULL[i]}
                      date={weekDates[i]}
                      onClick={() => setSelectedSession(grid[i])}
                    />
                  ) : (
                    <div className={`h-20 rounded-xl border border-dashed ${todayMark ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/5"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── MOBILE: vertical list ── */}
          <div className="sm:hidden space-y-2">
            {DAY_NAMES_FULL.map((day, i) => {
              const date = weekDates[i];
              const session = grid[i];
              const todayMark = date ? isToday(date.toISOString()) : false;
              const colors = session ? (SESSION_COLORS[session.type] ?? SESSION_COLORS.EASY) : null;

              return (
                <div
                  key={day}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    todayMark ? "border-primary/40 bg-primary/5" :
                    session ? `${colors!.border} ${colors!.bg}` :
                    "border-border/30 bg-muted/5 opacity-40"
                  }`}
                  onClick={() => session && setSelectedSession(session)}
                >
                  {/* Day */}
                  <div className="w-10 shrink-0 text-center">
                    <p className={`text-xs font-bold ${todayMark ? "text-primary" : "text-muted-foreground"}`}>{day.slice(0,3)}</p>
                    {date && <p className="text-xs text-muted-foreground">{date.getDate()}/{date.getMonth()+1}</p>}
                  </div>

                  {/* Session or rest */}
                  {session ? (
                    <>
                      <span className="text-xl">{SESSION_ICONS[session.type] ?? "🏃"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${colors!.text}`}>
                          {SESSION_LABELS[session.type] ?? session.type}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[
                            session.distanceKm && `${session.distanceKm}km`,
                            session.durationMin && `${session.durationMin}min`,
                            session.zone,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {session.completed && <CheckCircle2 className="h-5 w-5 text-green-400" />}
                        {session.skipped   && <XCircle      className="h-5 w-5 text-muted-foreground" />}
                        {!session.completed && !session.skipped && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Descanso</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Week progress timeline */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" /> Semanas del plan
            </p>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {Array.from({ length: weeks }, (_, i) => i + 1).map(w => {
                const ws = weekStats(activePlan.sessions, w);
                const pct = ws.total > 0 ? ws.done / ws.total : 0;
                return (
                  <button
                    key={w}
                    onClick={() => setCurrentWeek(w)}
                    title={`Semana ${w}: ${ws.done}/${ws.total}`}
                    className={`flex-1 min-w-[20px] space-y-0.5 transition-all ${
                      w === currentWeek ? "opacity-100" : "opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div className={`h-1.5 rounded-full overflow-hidden ${w === currentWeek ? "ring-1 ring-primary" : ""} bg-muted`}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <p className={`text-center text-[10px] ${w === currentWeek ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      {w}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Plans list */}
      {plans.length > 1 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Todos los planes</h2>
          <div className="space-y-2">
            {plans.map(plan => (
              <div key={plan.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(plan.startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    {" → "}
                    {new Date(plan.endDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{plan.sessions.length} sesiones
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    plan.status === "ACTIVE"   ? "bg-green-500/15 text-green-400" :
                    plan.status === "PAUSED"   ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {plan.status === "ACTIVE" ? "Activo" : plan.status === "PAUSED" ? "Pausado" : "Completado"}
                  </span>
                  {plan.status !== "ACTIVE" && (
                    <button onClick={() => switchPlanStatus(plan.id, "ACTIVE")} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted">
                      Activar
                    </button>
                  )}
                  {plan.status === "ACTIVE" && (
                    <button onClick={() => switchPlanStatus(plan.id, "PAUSED")} className="rounded-lg border border-border p-1 text-xs hover:bg-muted">
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => deletePlan(plan.id)} disabled={deletingPlan === plan.id} className="rounded-lg p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400">
                    {deletingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showGenerateModal && (
        <GeneratePlanModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={() => { setShowGenerateModal(false); loadPlans(); }}
        />
      )}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onAction={handleSessionAction}
          onSaveNotes={handleSaveNotes}
        />
      )}
    </div>
  );
}
