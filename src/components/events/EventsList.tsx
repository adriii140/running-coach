"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Calendar, Trophy, ExternalLink, Trash2,
  CheckCircle2, Clock, Flag, Zap, Mountain, Users, Bike, Star
} from "lucide-react";
import { EventForm } from "./EventForm";

interface SportEvent {
  id: string;
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

interface EventsListProps {
  initialEvents: SportEvent[];
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ROAD_RACE:  { label: "Asfalto",    icon: <Flag className="h-3.5 w-3.5" />,       color: "text-blue-400 bg-blue-400/10" },
  TRAIL_RACE: { label: "Trail",      icon: <Mountain className="h-3.5 w-3.5" />,    color: "text-green-400 bg-green-400/10" },
  RELAY:      { label: "Relevos",    icon: <Users className="h-3.5 w-3.5" />,       color: "text-purple-400 bg-purple-400/10" },
  TRIATHLON:  { label: "Triatlón",   icon: <Bike className="h-3.5 w-3.5" />,        color: "text-orange-400 bg-orange-400/10" },
  OBSTACLE:   { label: "Obstáculos", icon: <Zap className="h-3.5 w-3.5" />,         color: "text-red-400 bg-red-400/10" },
  VIRTUAL:    { label: "Virtual",    icon: <Trophy className="h-3.5 w-3.5" />,      color: "text-cyan-400 bg-cyan-400/10" },
  FUN_RUN:    { label: "Fun Run",    icon: <Star className="h-3.5 w-3.5" />,        color: "text-yellow-400 bg-yellow-400/10" },
  CUSTOM:     { label: "Otro",       icon: <Calendar className="h-3.5 w-3.5" />,    color: "text-muted-foreground bg-muted" },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  PRIMARY:   { label: "A",  color: "text-yellow-400 border-yellow-400/40" },
  SECONDARY: { label: "B",  color: "text-blue-400 border-blue-400/40" },
  TERTIARY:  { label: "C",  color: "text-muted-foreground border-border" },
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function DaysChip({ days }: { days: number }) {
  if (days < 0) return <span className="text-xs text-muted-foreground">Finalizada</span>;
  if (days === 0) return <span className="text-xs font-bold text-primary">¡Hoy!</span>;
  if (days <= 7)  return <span className="text-xs font-semibold text-orange-400">En {days}d</span>;
  if (days <= 30) return <span className="text-xs text-yellow-400">En {days}d</span>;
  return <span className="text-xs text-muted-foreground">En {days}d</span>;
}

export function EventsList({ initialEvents }: EventsListProps) {
  const [events, setEvents] = useState<SportEvent[]>(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const handleSaved = () => {
    setShowForm(false);
    router.refresh();
    // Recargamos los eventos
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este evento?")) return;
    setDeletingId(id);
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
  };

  const handleToggleRegistered = async (event: SportEvent) => {
    const updated = { registered: !event.registered };
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, ...updated } : e));
  };

  const upcoming = events.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = events.filter((e) => daysUntil(e.date) < 0).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      {showForm && <EventForm onClose={() => setShowForm(false)} onSaved={handleSaved} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Carreras y eventos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {upcoming.length} próximos · {past.length} completados
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + Añadir evento
          </button>
        </div>

        {/* Próximos */}
        {upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próximos</h2>
            <div className="space-y-2">
              {upcoming.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onDelete={handleDelete}
                  onToggleRegistered={handleToggleRegistered}
                  deleting={deletingId === event.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pasados */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completados</h2>
            <div className="space-y-2 opacity-60">
              {past.slice(0, 5).map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onDelete={handleDelete}
                  onToggleRegistered={handleToggleRegistered}
                  deleting={deletingId === event.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty */}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <Trophy className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-medium">Sin eventos registrados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Añade tu próxima carrera para que el Coach AI la tenga en cuenta en tu planificación.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Añadir primer evento
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function EventCard({
  event,
  onDelete,
  onToggleRegistered,
  deleting,
}: {
  event: SportEvent;
  onDelete: (id: string) => void;
  onToggleRegistered: (e: SportEvent) => void;
  deleting: boolean;
}) {
  const type = TYPE_LABELS[event.eventType] ?? TYPE_LABELS.CUSTOM;
  const priority = PRIORITY_LABELS[event.priority] ?? PRIORITY_LABELS.TERTIARY;
  const days = daysUntil(event.date);
  const dateStr = new Date(event.date).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="group flex items-start gap-4 rounded-xl border border-border/50 bg-card/40 px-4 py-3 hover:border-border transition-colors">
      {/* Priority badge */}
      <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${priority.color}`}>
        {priority.label}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{event.name}</span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
            {type.icon} {type.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {dateStr}
          </span>
          {event.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {event.city}{event.country && event.country !== "España" ? `, ${event.country}` : ""}
            </span>
          )}
          {event.distanceKm && (
            <span>{event.distanceKm} km</span>
          )}
          {event.elevationGain && (
            <span className="flex items-center gap-1">
              <Mountain className="h-3 w-3" /> {event.elevationGain}m D+
            </span>
          )}
          {event.price && (
            <span>{event.price}€</span>
          )}
        </div>

        {event.notes && (
          <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-1">{event.notes}</p>
        )}
      </div>

      {/* Right side */}
      <div className="shrink-0 flex flex-col items-end gap-2">
        <DaysChip days={days} />
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleRegistered(event)}
            title={event.registered ? "Inscrito" : "Marcar como inscrito"}
            className={`transition-colors ${event.registered ? "text-green-400" : "text-muted-foreground hover:text-green-400"}`}
          >
            {event.registered ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </button>
          {event.url && (
            <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => onDelete(event.id)}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {event.registered && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Inscrito
          </span>
        )}
      </div>
    </div>
  );
}
