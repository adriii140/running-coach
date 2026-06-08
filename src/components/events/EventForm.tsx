"use client";

import { useState } from "react";
import { X, Loader2, Sparkles, Link } from "lucide-react";

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
  { value: "PRIMARY", label: "A — Principal" },
  { value: "SECONDARY", label: "B — Secundaria" },
  { value: "TERTIARY", label: "C — Preparatoria" },
];

export interface EventData {
  id?: string;
  name: string;
  eventType: string;
  date: string;
  distanceKm: number | null;
  city: string | null;
  country: string | null;
  url: string | null;
  price: number | null;
  registered: boolean;
  priority: string;
  elevationGain: number | null;
  notes: string | null;
}

interface EventFormProps {
  onClose: () => void;
  onSaved: () => void;
  initialEvent?: EventData; // provided when editing
}

const INPUT = "w-full bg-muted/40 border border-border/60 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/60 transition-colors";

function toFormDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  // ISO string → take date part
  return isoOrDate.slice(0, 10);
}

export function EventForm({ onClose, onSaved, initialEvent }: EventFormProps) {
  const isEditing = !!initialEvent?.id;
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name:          initialEvent?.name          ?? "",
    eventType:     initialEvent?.eventType     ?? "ROAD_RACE",
    date:          toFormDate(initialEvent?.date),
    distanceKm:    initialEvent?.distanceKm    != null ? String(initialEvent.distanceKm)    : "",
    city:          initialEvent?.city          ?? "",
    country:       initialEvent?.country       ?? "España",
    url:           initialEvent?.url           ?? "",
    price:         initialEvent?.price         != null ? String(initialEvent.price)         : "",
    registered:    initialEvent?.registered    ?? false,
    priority:      initialEvent?.priority      ?? "SECONDARY",
    elevationGain: initialEvent?.elevationGain != null ? String(initialEvent.elevationGain) : "",
    notes:         initialEvent?.notes         ?? "",
  });

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // AI extraction from URL
  const extractFromUrl = async () => {
    if (!form.url) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/events/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al extraer datos");
      const d = json.data;
      setForm((prev) => ({
        ...prev,
        name:          d.name          ?? prev.name,
        eventType:     d.eventType     ?? prev.eventType,
        date:          d.date          ?? prev.date,
        distanceKm:    d.distanceKm    != null ? String(d.distanceKm)    : prev.distanceKm,
        city:          d.city          ?? prev.city,
        country:       d.country       ?? prev.country,
        elevationGain: d.elevationGain != null ? String(d.elevationGain) : prev.elevationGain,
        price:         d.price         != null ? String(d.price)         : prev.price,
        notes:         d.notes         ?? prev.notes,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al extraer datos");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.date) return;
    setLoading(true);
    setError(null);
    try {
      const url    = isEditing ? `/api/events/${initialEvent!.id}` : "/api/events";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="font-semibold text-base">
            {isEditing ? "Editar evento" : "Nueva carrera / evento"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* URL + AI — first so user can auto-fill */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5 text-muted-foreground" />
              Web del evento
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://www.micarrera.com"
                className={`${INPUT} flex-1`}
              />
              <button
                type="button"
                onClick={extractFromUrl}
                disabled={!form.url || extracting}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-medium hover:bg-orange-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Rellenar con IA desde la URL"
              >
                {extracting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{extracting ? "Leyendo..." : "IA"}</span>
              </button>
            </div>
            {extracting && (
              <p className="text-xs text-muted-foreground">Analizando la página con IA…</p>
            )}
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ej. 10K Bilbao Night Run"
              className={INPUT}
            />
          </div>

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo *</label>
              <select value={form.eventType} onChange={(e) => set("eventType", e.target.value)} className={INPUT}>
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Prioridad</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={INPUT}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha — full width on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha *</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                style={{ colorScheme: "dark" }}
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Distancia (km)</label>
              <input
                type="number" step="0.1" min="0"
                value={form.distanceKm}
                onChange={(e) => set("distanceKm", e.target.value)}
                placeholder="ej. 10"
                className={INPUT}
              />
            </div>
          </div>

          {/* Ciudad + País */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ciudad</label>
              <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="ej. Bilbao" className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">País</label>
              <input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="ej. España" className={INPUT} />
            </div>
          </div>

          {/* Desnivel + Precio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Desnivel+ (m)</label>
              <input type="number" min="0" value={form.elevationGain} onChange={(e) => set("elevationGain", e.target.value)} placeholder="ej. 500" className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Precio (€)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="ej. 25" className={INPUT} />
            </div>
          </div>

          {/* Inscrito */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.registered}
              onChange={(e) => set("registered", e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
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
              className={`${INPUT} resize-none`}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border/60 text-sm hover:bg-muted/40 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !form.name || !form.date}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar cambios" : "Guardar evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
