"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Activity, Heart, ChevronDown, ChevronUp } from "lucide-react";

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
      <p className={`text-xl sm:text-2xl font-bold mt-0.5 tabular-nums ${color ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="font-semibold text-sm text-left">{title}</h3>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
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
    <div className="space-y-5">
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
          label="Forma (TSB)"
          value={currentBrain ? (currentBrain.tsb > 0 ? `+${currentBrain.tsb.toFixed(1)}` : `${currentBrain.tsb.toFixed(1)}`) : "–"}
          sub={tsbLabel}
          color={tsbColor}
        />
      </div>

      {/* Charts — collapsible on mobile */}
      <div className="space-y-3">
        <ChartCard title="Kilómetros por semana" icon={<Activity className="h-4 w-4" />} defaultOpen={true}>
          {weeklyData.length > 0
            ? <WeeklyKmChart data={weeklyData} />
            : <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
          }
        </ChartCard>

        <ChartCard title="Fitness · Fatiga · Forma (CTL / ATL / TSB)" icon={<Heart className="h-4 w-4" />} defaultOpen={false}>
          {fitnessHistory.length > 0
            ? <FitnessChart data={fitnessHistory} />
            : <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
          }
        </ChartCard>

        <ChartCard
          title="Ritmo por carrera"
          icon={<TrendingUp className="h-4 w-4" />}
          defaultOpen={false}
        >
          {pacePoints.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Cada burbuja es una carrera — el tamaño indica la distancia (km)
              </p>
              <PaceChart data={pacePoints} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin carreras con GPS en este periodo</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
