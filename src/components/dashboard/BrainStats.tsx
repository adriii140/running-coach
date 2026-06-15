"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Heart, Trophy, Flame, Info } from "lucide-react";
import { formatPace, formatDuration, tsbLabel } from "@/components/shared/format";
import type { RunningBrain } from "@prisma/client";
import { useState } from "react";

interface BrainStatsProps {
  brain: RunningBrain | null;
}

function TrainingLoadCard({ brain, tsb, tsbText, tsbColor }: {
  brain: RunningBrain;
  tsb: number;
  tsbText: string;
  tsbColor: string;
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-red-400" />
            Carga &amp; forma
          </CardTitle>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/40"
            title="¿Qué significa esto?"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Explicación colapsable */}
          {showInfo && (
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3 space-y-2 text-xs text-muted-foreground">
              <p><span className="text-blue-400 font-semibold">Fitness (CTL)</span> — forma acumulada de los últimos 42 días. Cuanto más alto, mejor base de entrenamiento tienes.</p>
              <p><span className="text-red-400 font-semibold">Fatiga (ATL)</span> — carga de los últimos 7 días. Si descansaste esta semana, será baja. Si entrenaste fuerte, alta.</p>
              <p><span className="text-green-400 font-semibold">Forma (TSB)</span> — Fitness menos Fatiga. <strong>Positivo</strong> = estás fresco para rendir. <strong>Negativo</strong> = estás cargado, toca recuperar.</p>
              <p className="text-muted-foreground/60 text-[10px] pt-1">Modelo Banister (CTL/ATL/TSB) usado por ciclistas y runners de élite.</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estado hoy</span>
            <Badge variant="outline" className={tsbColor}>
              {tsbText}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2">
              <p className="text-[10px] text-muted-foreground leading-tight">Fitness<br/><span className="text-muted-foreground/60">(42 días)</span></p>
              <p className="font-bold text-blue-400 mt-0.5">{brain.ctl?.toFixed(1) ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-2">
              <p className="text-[10px] text-muted-foreground leading-tight">Fatiga<br/><span className="text-muted-foreground/60">(7 días)</span></p>
              <p className="font-bold text-red-400 mt-0.5">{brain.atl?.toFixed(1) ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-2">
              <p className="text-[10px] text-muted-foreground leading-tight">Forma<br/><span className="text-muted-foreground/60">(TSB)</span></p>
              <p className={`font-bold mt-0.5 ${tsbColor}`}>
                {brain.tsb !== null
                  ? (brain.tsb > 0 ? "+" : "") + brain.tsb.toFixed(1)
                  : "—"}
              </p>
            </div>
          </div>
          {/* Race window indicator */}
          {brain.tsb !== null && brain.tsb > 5 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <p className="text-xs font-semibold text-emerald-400">Ventana óptima</p>
                <p className="text-[10px] text-muted-foreground">Estás fresco — buen momento para rendir al máximo</p>
              </div>
            </div>
          )}
          {brain.tsb !== null && brain.tsb < -25 && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-red-400">Fatiga elevada</p>
                <p className="text-[10px] text-muted-foreground">Prioriza recuperación antes de sesiones duras</p>
              </div>
            </div>
          )}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Esta semana</span>
              <span className="font-semibold">{brain.weeklyLoadKm?.toFixed(1) ?? "0"} km</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Este mes</span>
              <span className="font-semibold">{brain.monthlyLoadKm?.toFixed(1) ?? "0"} km</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BrainStats({ brain }: BrainStatsProps) {
  if (!brain) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-purple-400" />
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
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-400" />
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
                <div key={r.label} className="flex justify-between items-center text-sm py-1 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono font-semibold text-yellow-400">
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
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-400" />
            Zonas de ritmo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {brain.paceThresholdSec ? (
            <div className="space-y-1.5">
              {/* Zones displayed as ranges — fastest (Z5) to slowest (Z1) */}
              {(() => {
                const T  = brain.paceThresholdSec!;
                const T4 = brain.paceTempoSec ?? Math.round(T * 1.04);
                const T3 = brain.paceAerobicSec ?? Math.round(T * 1.10);
                const T2 = brain.paceEasySec    ?? Math.round(T * 1.20);
                const T1 = brain.paceRecoverySec ?? Math.round(T * 1.35);
                const zones = [
                  { label: "Z5 · Umbral",       lo: T,  hi: T4, color: "bg-red-500",    text: "text-red-400"    },
                  { label: "Z4 · Tempo",         lo: T4, hi: T3, color: "bg-orange-500", text: "text-orange-400" },
                  { label: "Z3 · Aeróbico",      lo: T3, hi: T2, color: "bg-yellow-500", text: "text-yellow-400" },
                  { label: "Z2 · Fácil",         lo: T2, hi: T1, color: "bg-green-500",  text: "text-green-400"  },
                  { label: "Z1 · Recuperación",  lo: T1, hi: null, color: "bg-blue-500", text: "text-blue-400"   },
                ];
                return zones.map((z) => (
                  <div key={z.label} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${z.color}`} />
                    <span className="flex-1 text-xs text-muted-foreground">{z.label}</span>
                    <span className={`font-mono text-xs font-semibold ${z.text}`}>
                      {formatPace(z.lo)}{z.hi ? `–${formatPace(z.hi)}` : "+"} /km
                    </span>
                  </div>
                ));
              })()}
              <p className="text-xs text-muted-foreground/50 pt-1 text-right">
                {brain.hrMax ? "Basado en FC umbral" : "Estimado por VDOT"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Se calculan al sincronizar actividades con datos de FC o un 5K/10K.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Carga de entrenamiento */}
      <TrainingLoadCard brain={brain} tsb={tsb} tsbText={tsbText} tsbColor={tsbColor} />

      {/* Totales */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-purple-400" />
            Historial total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              {
                label: "Distancia total",
                value: `${brain.totalDistanceKm?.toFixed(0) ?? "0"} km`,
                color: "text-blue-400",
              },
              {
                label: "Actividades",
                value: String(brain.totalActivities ?? 0),
                color: "text-orange-400",
              },
              {
                label: "Desnivel total",
                value: `${((brain.totalElevationM ?? 0) / 1000).toFixed(1)} km D+`,
                color: "text-green-400",
              },
              {
                label: "Sesiones fuerza",
                value: String(brain.totalStrengthSessions ?? 0),
                color: "text-yellow-400",
              },
              ...(brain.vo2max
                ? [
                    {
                      label: "VO2max est.",
                      value: `${brain.vo2max.toFixed(1)} ml/kg/min`,
                      color: "text-purple-400",
                    },
                  ]
                : []),
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between items-center text-sm py-1 border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
