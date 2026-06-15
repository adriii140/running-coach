"use client";

import Link from "next/link";
import {
  CheckCircle2, ChevronRight, Zap, Clock, Mountain, MapPin,
} from "lucide-react";

interface TodaySessionProps {
  session: {
    id: string;
    type: string;
    distanceKm: number | null;
    durationMin: number | null;
    elevationM: number | null;
    zone: string | null;
    description: string | null;
    completed: boolean;
    skipped: boolean;
    planName: string;
  } | null;
}

const SESSION_COLORS: Record<string, string> = {
  EASY:           "from-green-500/20 to-green-500/5 border-green-500/30",
  LONG:           "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  TEMPO:          "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  INTERVALS:      "from-red-500/20 to-red-500/5 border-red-500/30",
  RECOVERY:       "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  RACE:           "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
  STRENGTH:       "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  CROSS_TRAINING: "from-teal-500/20 to-teal-500/5 border-teal-500/30",
  REST:           "from-muted/30 to-muted/10 border-border",
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

export function TodaySession({ session }: TodaySessionProps) {
  if (!session) return null;

  const colors = SESSION_COLORS[session.type] ?? SESSION_COLORS.EASY;
  const label = SESSION_LABELS[session.type] ?? session.type;
  const icon = SESSION_ICONS[session.type] ?? "🏃";

  return (
    <Link href="/training" className="block">
      <div
        className={`rounded-2xl border bg-gradient-to-br p-4 transition-all hover:shadow-md ${colors} ${
          session.completed ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Hoy toca · {session.planName}
              </p>
              <p className="text-base font-semibold">{label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            {session.completed && <CheckCircle2 className="h-4 w-4 text-green-400" />}
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {session.distanceKm && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 opacity-60" />
              {session.distanceKm} km
            </span>
          )}
          {session.durationMin && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Clock className="h-3.5 w-3.5 opacity-60" />
              {session.durationMin} min
            </span>
          )}
          {session.elevationM && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Mountain className="h-3.5 w-3.5 opacity-60" />
              {session.elevationM}m D+
            </span>
          )}
          {session.zone && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Zap className="h-3.5 w-3.5 opacity-60" />
              {session.zone}
            </span>
          )}
        </div>

        {session.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {session.description}
          </p>
        )}

        {session.completed && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Sesión completada
          </div>
        )}
      </div>
    </Link>
  );
}
