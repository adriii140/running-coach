"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Sparkles, Pencil, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Loader2, CalendarDays, BarChart3,
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

const SESSION_COLORS: Record<string, string> = {
  EASY:          "bg-green-500/15 text-green-400 border-green-500/30",
  LONG:          "bg-blue-500/15 text-blue-400 border-blue-500/30",
  TEMPO:         "bg-orange-500/15 text-orange-400 border-orange-500/30",
  INTERVALS:     "bg-red-500/15 text-red-400 border-red-500/30",
  RECOVERY:      "bg-purple-500/15 text-purple-400 border-purple-500/30",
  RACE:          "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  STRENGTH:      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  CROSS_TRAINING:"bg-teal-500/15 text-teal-400 border-teal-500/30",
  REST:          "bg-muted/40 text-muted-foreground border-border",
};

const SESSION_LABELS: Record<string, string> = {
  EASY: "Rodaje fácil", LONG: "Tirada larga", TEMPO: "Tempo",
  INTERVALS: "Series", RECOVERY: "Recuperación", RACE: "Carrera",
  STRENGTH: "Fuerza", CROSS_TRAINING: "Entreno cruzado", REST: "Descanso",
};

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function getWeekSessions(sessions: PlannedSession[], weekNum: number): (PlannedSession | null)[] {
  const week = sessions.filter(s => s.weekNumber === weekNum);
  const grid: (PlannedSession | null)[] = Array(7).fill(null);
  week.forEach(s => {
    const d = new Date(s.date);
    const dow = (d.getDay() + 6) % 7; // 0=Lun
    grid[dow] = s;
  });
  return grid;
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
  return { km: km.toFixed(0), done, total: w.length };
}

// ─── Generate Plan Modal ───────────────────────────────────────────────────────

function GeneratePlanModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (plan: TrainingPlan) => void;
}) {
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [currentWeeklyKm, setCurrentWeeklyKm] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
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
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Generar plan con IA</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Fecha de inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Días de entreno por semana</label>
            <div className="flex gap-2">
              {[3, 4, 5, 6].map(d => (
                <button
                  key={d}
                  onClick={() => setDaysPerWeek(d)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
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
            <label className="mb-1 block text-sm text-muted-foreground">
              Km/semana actuales <span className="text-xs">(opcional)</span>
            </label>
            <input
              type="number"
              placeholder="Ej: 40"
              value={currentWeeklyKm}
              onChange={e => setCurrentWeeklyKm(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Notas para el coach <span className="text-xs">(opcional)</span>
            </label>
            <textarea
              placeholder="Ej: Tengo maratón en 12 semanas, suelo lesionarme la rodilla..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-medium hover:bg-muted/50"
          >
            Cancelar
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
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
  );
}

// ─── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onAction,
}: {
  session: PlannedSession;
  onAction: (id: string, action: "complete" | "skip" | "reset") => void;
}) {
  const colorClass = SESSION_COLORS[session.type] ?? SESSION_COLORS.EASY;
  const label = SESSION_LABELS[session.type] ?? session.type;

  return (
    <div
      className={`group relative rounded-xl border p-3 text-left transition-all ${
        session.completed
          ? "border-green-500/30 bg-green-500/5 opacity-80"
          : session.skipped
          ? "border-border bg-muted/20 opacity-50"
          : `${colorClass}`
      }`}
    >
      {/* Status badge */}
      {session.completed && (
        <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-green-400" />
      )}
      {session.skipped && (
        <XCircle className="absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
      )}

      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>

      {session.distanceKm && (
        <p className="mt-0.5 text-sm font-bold">{session.distanceKm} km</p>
      )}
      {session.durationMin && !session.distanceKm && (
        <p className="mt-0.5 text-sm font-bold">{session.durationMin} min</p>
      )}
      {session.zone && (
        <span className="mt-1 inline-block rounded-md bg-black/20 px-1.5 py-0.5 text-xs font-medium">
          {session.zone}
        </span>
      )}
      {session.description && (
        <p className="mt-1.5 line-clamp-2 text-xs opacity-70">{session.description}</p>
      )}
      {session.targetPaceSec && (
        <p className="mt-1 text-xs opacity-60">{formatPace(session.targetPaceSec)}</p>
      )}

      {/* Actions */}
      {!session.completed && !session.skipped && (
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => onAction(session.id, "complete")}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-500/20 py-1 text-xs font-medium text-green-400 hover:bg-green-500/30"
          >
            <CheckCircle2 className="h-3 w-3" /> Hecho
          </button>
          <button
            onClick={() => onAction(session.id, "skip")}
            className="flex items-center justify-center rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80"
          >
            <XCircle className="h-3 w-3" />
          </button>
        </div>
      )}
      {(session.completed || session.skipped) && (
        <button
          onClick={() => onAction(session.id, "reset")}
          className="mt-2 w-full rounded-lg bg-muted/50 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Deshacer
        </button>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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
        // Set current week based on today's date
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
    // Update local state optimistically
    setActivePlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === sessionId
            ? {
                ...s,
                completed: action === "complete",
                skipped: action === "skip",
              }
            : s
        ),
      };
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

  // ── Render ──
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const weeks = activePlan ? totalWeeks(activePlan) : 0;
  const grid = activePlan ? getWeekSessions(activePlan.sessions, currentWeek) : [];
  const stats = activePlan ? weekStats(activePlan.sessions, currentWeek) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de entrenamiento</h1>
          <p className="text-sm text-muted-foreground">
            {activePlan ? activePlan.name : "Sin plan activo"}
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          Nuevo plan IA
        </button>
      </div>

      {/* No active plan */}
      {!activePlan && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="text-lg font-medium">No tienes ningún plan activo</p>
            <p className="mt-1 text-sm text-muted-foreground">
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

      {/* Active plan view */}
      {activePlan && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <button
              onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
              disabled={currentWeek === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 text-center">
              <p className="text-sm font-semibold">Semana {currentWeek} de {weeks}</p>
              {stats && (
                <p className="text-xs text-muted-foreground">
                  {stats.km} km · {stats.done}/{stats.total} sesiones completadas
                </p>
              )}
            </div>

            <button
              onClick={() => setCurrentWeek(w => Math.min(weeks, w + 1))}
              disabled={currentWeek === weeks}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-2">
            {DAY_NAMES.map((day, i) => (
              <div key={day}>
                <p className="mb-1.5 text-center text-xs font-medium text-muted-foreground">{day}</p>
                {grid[i] ? (
                  <SessionCard
                    session={grid[i]!}
                    onAction={handleSessionAction}
                  />
                ) : (
                  <div className="h-20 rounded-xl border border-dashed border-border/40 bg-muted/10" />
                )}
              </div>
            ))}
          </div>

          {/* Progress overview */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Progreso del plan</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: weeks }, (_, i) => i + 1).map(w => {
                const ws = weekStats(activePlan.sessions, w);
                const pct = ws.total > 0 ? ws.done / ws.total : 0;
                return (
                  <button
                    key={w}
                    onClick={() => setCurrentWeek(w)}
                    title={`S${w}: ${ws.done}/${ws.total}`}
                    className={`relative flex-1 rounded-sm transition-all ${
                      w === currentWeek ? "ring-1 ring-primary" : ""
                    }`}
                  >
                    <div className="h-2 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm bg-primary transition-all"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {activePlan.sessions.filter(s => s.completed).length} /{" "}
              {activePlan.sessions.length} sesiones completadas
            </p>
          </div>
        </div>
      )}

      {/* All plans list */}
      {plans.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Todos los planes
          </h2>
          <div className="space-y-2">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(plan.startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    {" → "}
                    {new Date(plan.endDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {plan.sessions.length} sesiones
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      plan.status === "ACTIVE"
                        ? "bg-green-500/15 text-green-400"
                        : plan.status === "PAUSED"
                        ? "bg-yellow-500/15 text-yellow-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {plan.status === "ACTIVE" ? "Activo" : plan.status === "PAUSED" ? "Pausado" : "Completado"}
                  </span>
                  {plan.status !== "ACTIVE" && (
                    <button
                      onClick={() => switchPlanStatus(plan.id, "ACTIVE")}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      Activar
                    </button>
                  )}
                  {plan.status === "ACTIVE" && (
                    <button
                      onClick={() => switchPlanStatus(plan.id, "PAUSED")}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Clock className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => deletePlan(plan.id)}
                    disabled={deletingPlan === plan.id}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  >
                    {deletingPlan === plan.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate modal */}
      {showGenerateModal && (
        <GeneratePlanModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={plan => {
            setShowGenerateModal(false);
            loadPlans();
          }}
        />
      )}
    </div>
  );
}
