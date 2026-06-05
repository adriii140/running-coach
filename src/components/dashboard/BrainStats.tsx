"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Heart, Trophy, Flame } from "lucide-react";
import { formatPace, formatDuration, tsbLabel } from "@/components/shared/format";
import type { RunningBrain } from "@prisma/client";

interface BrainStatsProps {
  brain: RunningBrain | null;
}

export function BrainStats({ brain }: BrainStatsProps) {
  if (!brain) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-purple-500" />
            Running Brain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sincroniza actividades para activar el Running Brain.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tsb = brain.tsb ?? 0;
  const { label: tsbText, color: tsbColor } = tsbLabel(tsb);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Récords */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Récords personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: "1 km", sec: brain.best1kSec },
              { label: "5 km", sec: brain.best5kSec },
              { label: "10 km", sec: brain.best10kSec },
              { label: "Media", sec: brain.bestHalfSec },
              { label: "Maratón", sec: brain.bestMarathonSec },
            ]
              .filter((r) => r.sec)
              .map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono font-medium">
                    {formatDuration(r.sec!)}
                  </span>
                </div>
              ))}
            {!brain.best5kSec && !brain.best10kSec && (
              <p className="text-xs text-muted-foreground">
                Sin récords detectados aún.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zonas de ritmo */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-500" />
            Zonas de ritmo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: "Recuperación", sec: brain.paceRecoverySec, color: "bg-blue-500" },
              { label: "Fácil", sec: brain.paceEasySec, color: "bg-green-500" },
              { label: "Aeróbico", sec: brain.paceAerobicSec, color: "bg-yellow-500" },
              { label: "Tempo", sec: brain.paceTempoSec, color: "bg-orange-500" },
              { label: "Umbral", sec: brain.paceThresholdSec, color: "bg-red-500" },
            ]
              .filter((z) => z.sec)
              .map((z) => (
                <div key={z.label} className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full ${z.color}`} />
                  <span className="flex-1 text-muted-foreground">{z.label}</span>
                  <span className="font-mono text-xs">
                    {formatPace(z.sec!)} /km
                  </span>
                </div>
              ))}
            {!brain.paceThresholdSec && (
              <p className="text-xs text-muted-foreground">
                Se calculan con el primer 5K o 10K.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Carga de entrenamiento */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-red-500" />
            Carga & forma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge variant="outline" className={tsbColor}>
                {tsbText}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">Fitness</p>
                <p className="font-bold">{brain.ctl?.toFixed(1) ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">Fatiga</p>
                <p className="font-bold">{brain.atl?.toFixed(1) ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">Forma</p>
                <p className={`font-bold ${tsbColor}`}>
                  {brain.tsb !== null ? (brain.tsb > 0 ? "+" : "") + brain.tsb.toFixed(1) : "—"}
                </p>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Semana</span>
              <span className="font-medium">
                {brain.weeklyLoadKm?.toFixed(1) ?? "0"} km
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mes</span>
              <span className="font-medium">
                {brain.monthlyLoadKm?.toFixed(1) ?? "0"} km
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totales */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-purple-500" />
            Historial total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Distancia total</span>
              <span className="font-medium">
                {brain.totalDistanceKm?.toFixed(0) ?? "0"} km
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Actividades</span>
              <span className="font-medium">{brain.totalActivities ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Desnivel total</span>
              <span className="font-medium">
                {((brain.totalElevationM ?? 0) / 1000).toFixed(1)} km D+
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sesiones fuerza</span>
              <span className="font-medium">{brain.totalStrengthSessions ?? 0}</span>
            </div>
            {brain.vo2max && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VO2max est.</span>
                <span className="font-medium text-purple-500">
                  {brain.vo2max.toFixed(1)} ml/kg/min
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
