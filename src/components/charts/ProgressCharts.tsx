"use client";

import dynamic from "next/dynamic";
import { TrendingUp, Activity, Heart } from "lucide-react";

const WeeklyKmChart = dynamic(() => import("./WeeklyKmChart").then((m) => m.WeeklyKmChart), { ssr: false });
const FitnessChart  = dynamic(() => import("./FitnessChart").then((m) => m.FitnessChart),   { ssr: false });
const PaceChart     = dynamic(() => import("./PaceChart").then((m) => m.PaceChart),          { ssr: false });

interface Props {
  weeklyData: { week: string; km: number; runs: number }[];
  fitnessHistory: { date: string; ctl: number; atl: number; tsb: number }[];
  pacePoints: { date: string; km: number; paceSec: number; label: string }[];
  currentBrain: { ctl: number; atl: number; tsb: number } | null;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ProgressCharts({ weeklyData, fitnessHistory, pacePoints, currentBrain }: Props) {
  const totalKm = weeklyData.reduce((s, w) => s + w.km, 0);
  const avgKm   = weeklyData.length ? totalKm / weeklyData.length : 0;
  const maxWeek = weeklyData.reduce((m, w) => w.km > m.km ? w : m, { km: 0, week: "" });

  const tsbColor = !currentBrain ? "" :
    currentBrain.tsb > 10 ? "text-green-400" :
    currentBrain.tsb > -10 ? "text-blue-400" :
    currentBrain.tsb > -30 ? "text-yellow-400" : "text-red-400";

  const tsbLabel = !currentBrain ? "Sin datos" :
    currentBrain.tsb > 10 ? "Descansado" :
    currentBrain.tsb > -10 ? "Óptimo" :
    currentBrain.tsb > -30 ? "Cargado" : "Sobreentrenado";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progreso</h1>
        <p className="text-sm text-muted-foreground mt-1">Últimas 16 semanas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total 16 sem." value={`${totalKm.toFixed(0)} km`} />
        <StatCard label="Media semanal"  value={`${avgKm.toFixed(1)} km`} />
        <StatCard label="Mejor semana"   value={`${maxWeek.km.toFixed(1)} km`} sub={maxWeek.week} />
        <StatCard
          label="Forma actual (TSB)"
          value={currentBrain ? (currentBrain.tsb > 0 ? `+${currentBrain.tsb.toFixed(1)}` : `${currentBrain.tsb.toFixed(1)}`) : "–"}
          sub={tsbLabel}
          color={tsbColor}
        />
      </div>

      {/* Gráficas */}
      <div className="space-y-4">
        <ChartCard title="Kilómetros semanales" icon={<Activity className="h-4 w-4" />}>
          {weeklyData.length > 0
            ? <WeeklyKmChart data={weeklyData} />
            : <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
          }
        </ChartCard>

        <ChartCard title="Fitness · Fatiga · Forma (CTL / ATL / TSB)" icon={<Heart className="h-4 w-4" />}>
          {fitnessHistory.length > 0
            ? <FitnessChart data={fitnessHistory} />
            : <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
          }
        </ChartCard>

        <ChartCard title="Ritmo por carrera (tamaño = distancia)" icon={<TrendingUp className="h-4 w-4" />}>
          {pacePoints.length > 0
            ? <PaceChart data={pacePoints} />
            : <p className="text-sm text-muted-foreground py-8 text-center">Sin carreras con GPS en este periodo</p>
          }
        </ChartCard>
      </div>
    </div>
  );
}
