"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, Clock, TrendingUp, Heart, ChevronDown, ChevronUp, X
} from "lucide-react";

const ActivityMap = dynamic(
  () => import("@/components/maps/ActivityMap").then((m) => m.ActivityMap),
  { ssr: false, loading: () => <div className="h-48 bg-muted/30 rounded-lg animate-pulse" /> }
);

interface Activity {
  id: string;
  name: string;
  activityType: string;
  startDate: string;
  distance: number | null;
  movingTime: number | null;
  totalElevation: number | null;
  averageSpeed: number | null;
  averageHeartrate: number | null;
  mapPolyline: string | null;
}

interface Props {
  activities: Activity[];
}

const TYPE_COLORS: Record<string, string> = {
  Run:  "text-orange-400 bg-orange-400/10",
  Ride: "text-blue-400 bg-blue-400/10",
  Walk: "text-green-400 bg-green-400/10",
  Hike: "text-emerald-400 bg-emerald-400/10",
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatPace(speed: number): string {
  if (!speed) return "-";
  const secPerKm = 1000 / speed;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ActivityRow({ activity, onSelect }: { activity: Activity; onSelect: () => void }) {
  const km = activity.distance ? (activity.distance / 1000).toFixed(2) : null;
  const typeColor = TYPE_COLORS[activity.activityType] ?? "text-muted-foreground bg-muted";
  const date = new Date(activity.startDate).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short",
  });
  const hasMap = !!activity.mapPolyline;

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 rounded-xl border border-border/40 bg-card/30 transition-all ${hasMap ? "hover:border-primary/40 cursor-pointer" : ""}`}
      onClick={hasMap ? onSelect : undefined}
    >
      {/* Mini mapa thumbnail */}
      <div className="shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-muted/40">
        {hasMap ? (
          <ActivityMap polyline={activity.mapPolyline!} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="h-4 w-4 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{activity.name}</span>
          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeColor}`}>
            {activity.activityType}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>{date}</span>
          {km && <span>{km} km</span>}
          {activity.movingTime && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> {formatTime(activity.movingTime)}
            </span>
          )}
          {activity.averageSpeed && (
            <span>{formatPace(activity.averageSpeed)} /km</span>
          )}
          {activity.totalElevation && activity.totalElevation > 5 && (
            <span className="flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> {Math.round(activity.totalElevation)}m
            </span>
          )}
          {activity.averageHeartrate && (
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" /> {Math.round(activity.averageHeartrate)}
            </span>
          )}
        </div>
      </div>

      {hasMap && (
        <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

function MapModal({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const km = activity.distance ? (activity.distance / 1000).toFixed(2) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border/50">
          <div>
            <h3 className="font-semibold">{activity.name}</h3>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{new Date(activity.startDate).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              {km && <span>{km} km</span>}
              {activity.movingTime && <span>{formatTime(activity.movingTime)}</span>}
              {activity.averageSpeed && <span>{formatPace(activity.averageSpeed)} /km</span>}
              {activity.averageHeartrate && (
                <span className="flex items-center gap-0.5">
                  <Heart className="h-3 w-3" /> {Math.round(activity.averageHeartrate)} ppm
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors ml-4">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mapa grande e interactivo */}
        {activity.mapPolyline && (
          <ActivityMap
            polyline={activity.mapPolyline}
            className="w-full"
            interactive
            style={{ height: 400 } as React.CSSProperties}
          />
        )}
      </div>
    </div>
  );
}

export function ActivitiesWithMap({ activities }: Props) {
  const [selected, setSelected] = useState<Activity | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? activities : activities.slice(0, 20);

  return (
    <>
      {selected && <MapModal activity={selected} onClose={() => setSelected(null)} />}

      <div className="space-y-2">
        {visible.map((a) => (
          <ActivityRow key={a.id} activity={a} onSelect={() => setSelected(a)} />
        ))}
      </div>

      {activities.length > 20 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll ? (
            <><ChevronUp className="h-4 w-4" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="h-4 w-4" /> Ver las {activities.length - 20} actividades restantes</>
          )}
        </button>
      )}
    </>
  );
}
