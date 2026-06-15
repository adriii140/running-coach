"use client";

import { Activity, Clock, TrendingUp, Zap, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatTime } from "@/components/shared/format";

interface ActivityLite {
  distance: number | null;
  movingTime: number;
  totalElevation: number | null;
  activityType: string;
}

interface WeeklySummaryProps {
  activities: ActivityLite[];
  lastWeekActivities?: ActivityLite[];
}

function calcTotals(acts: ActivityLite[]) {
  const runs = acts.filter(a => ["RUN", "TRAIL_RUN", "VIRTUAL_RUN"].includes(a.activityType));
  return {
    km: runs.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000,
    seconds: runs.reduce((s, a) => s + a.movingTime, 0),
    elevation: runs.reduce((s, a) => s + (a.totalElevation ?? 0), 0),
    sessions: acts.length,
  };
}

function Trend({ current, prev, unit = "" }: { current: number; prev: number; unit?: string }) {
  if (prev === 0) return null;
  const diff = current - prev;
  const pct = Math.abs(Math.round((diff / prev) * 100));
  if (pct < 3) return <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus className="h-2.5 w-2.5" /> igual</span>;
  if (diff > 0) return (
    <span className="text-[10px] text-green-400 flex items-center gap-0.5">
      <ArrowUp className="h-2.5 w-2.5" />+{pct}%
    </span>
  );
  return (
    <span className="text-[10px] text-red-400 flex items-center gap-0.5">
      <ArrowDown className="h-2.5 w-2.5" />-{pct}%
    </span>
  );
}

export function WeeklySummary({ activities, lastWeekActivities = [] }: WeeklySummaryProps) {
  const curr = calcTotals(activities);
  const prev = calcTotals(lastWeekActivities);

  const stats = [
    {
      label: "Km corridos",
      value: curr.km.toFixed(1),
      unit: "km",
      raw: curr.km,
      prevRaw: prev.km,
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Tiempo",
      value: formatTime(curr.seconds),
      unit: "",
      raw: curr.seconds,
      prevRaw: prev.seconds,
      icon: Clock,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    },
    {
      label: "Desnivel",
      value: curr.elevation >= 1000
        ? `${(curr.elevation / 1000).toFixed(1)}km`
        : `${Math.round(curr.elevation)}m`,
      unit: "D+",
      raw: curr.elevation,
      prevRaw: prev.elevation,
      icon: TrendingUp,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    {
      label: "Sesiones",
      value: String(curr.sessions),
      unit: "",
      raw: curr.sessions,
      prevRaw: prev.sessions,
      icon: Zap,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border ${stat.border} bg-card/50 p-3 sm:p-4 transition-all hover:bg-card/70`}
        >
          <div className="flex items-start gap-2 sm:gap-3">
            <div className={`rounded-lg p-1.5 sm:p-2 ${stat.bg} shrink-0 mt-0.5`}>
              <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{stat.label}</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 leading-tight tabular-nums">
                {stat.value}
                {stat.unit && <span className="text-xs font-normal text-muted-foreground ml-0.5">{stat.unit}</span>}
              </p>
              <Trend current={stat.raw} prev={stat.prevRaw} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
