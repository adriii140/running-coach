"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const EVENT_TYPES = [
  { value: "ROAD_RACE", label: "Carrera en asfalto" },
  { value: "TRAIL_RACE", label: "Trail running" },
  { value: "RELAY", label: "Relevos" },
  { value: "TRIATHLON", label: "Triatlón" },
  { value: "OBSTACLE", label: "Carrera de obstáculos" },
  { value: "VIRTUAL", label: "Carrera virtual" },
  { value: "FUN_RUN", label: "Fun run" },
  { value: "CUSTOM", label: "Otro" },
];

const PRIORITIES = [
  { value: "PRIMARY", label: "A — Principal (objetivo clave)" },
  { value: "SECONDARY", label: "B — Secundaria" },
  { value: "TERTIARY", label: "C — Preparatoria" },
];

interface EventFormProps {
  onClose: () => void;
  onSaved: () => void;
}

export function EventForm({ onClose, onSaved }: EventFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    eventType: "ROAD_RACE",
    date: "",
    distanceKm: "",
    city: "",
    country: "España",
    url: "",
    price: "",
    registered: false,
    priority: "SECONDARY",
    elevationGain: "",
    notes: "",
  });

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.date) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al guardar");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h2 className="font-semibold text-base">Nueva carrera / evento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ej. 10K Bilbao Night Run"
              className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo *</label>
              <select
                value={form.eventType}
                onChange={(e) => set("eventType", e.target.value)}
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Prioridad</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha + Distancia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha *</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Distancia (km)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.distanceKm}
                onChange={(e) => set("distanceKm", e.target.value)}
                placeholder="ej. 10"
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>

          {/* Ciudad + País */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ciudad</label>
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="ej. Bilbao"
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">País</label>
              <input
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="ej. España"
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>

          {/* Desnivel + Precio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Desnivel+ (m)</label>
              <input
                type="number"
                min="0"
                value={form.elevationGain}
                onChange={(e) => set("elevationGain", e.target.value)}
                placeholder="ej. 500"
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Precio (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="ej. 25"
                className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Web del evento</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
              className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Inscrito */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.registered}
              onChange={(e) => set("registered", e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm">Ya estoy inscrito</span>
          </label>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notas</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Objetivo de tiempo, estrategia, equipo..."
              className="w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border/60 text-sm hover:bg-muted/40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !form.name || !form.date}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar evento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
