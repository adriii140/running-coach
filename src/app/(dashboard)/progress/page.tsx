import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProgressCharts } from "@/components/charts/ProgressCharts";

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Últimas 16 semanas de actividades
  const since = new Date();
  since.setDate(since.getDate() - 16 * 7);

  const activities = await prisma.activity.findMany({
    where: { userId: session.userId, startDate: { gte: since } },
    orderBy: { startDate: "asc" },
    select: {
      startDate: true,
      distance: true,
      movingTime: true,
      averageSpeed: true,
      activityType: true,
      name: true,
    },
  });

  const brain = await prisma.runningBrain.findUnique({
    where: { userId: session.userId },
    select: { ctl: true, atl: true, tsb: true },
  });

  // Agrupar por semana
  const weekMap = new Map<string, { km: number; runs: number }>();
  const pacePoints: { date: string; km: number; paceSec: number; label: string }[] = [];

  for (const a of activities) {
    const d = new Date(a.startDate);
    // Inicio de semana (lunes)
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

    const km = a.distance ? Number(a.distance) / 1000 : 0;
    const prev = weekMap.get(key) ?? { km: 0, runs: 0 };
    weekMap.set(key, { km: prev.km + km, runs: prev.runs + 1 });

    // Solo carreras con ritmo válido para el scatter
    if (["RUN", "TRAIL_RUN", "VIRTUAL_RUN"].includes(a.activityType) && a.averageSpeed && Number(a.averageSpeed) > 0 && km > 1) {
      const paceSec = 1000 / Number(a.averageSpeed);
      if (paceSec > 200 && paceSec < 900) { // filtrar outliers
        pacePoints.push({
          date: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
          km,
          paceSec,
          label: a.name,
        });
      }
    }
  }

  const weeklyData = Array.from(weekMap.entries()).map(([week, v]) => ({
    week,
    km: Math.round(v.km * 10) / 10,
    runs: v.runs,
  }));

  // Simular histórico CTL/ATL/TSB semanal a partir de actividades
  // (aproximación simple: acumulamos EWMA)
  const fitnessHistory: { date: string; ctl: number; atl: number; tsb: number }[] = [];
  let ctl = 0;
  let atl = 0;
  const ctlK = 1 / 42;
  const atlK = 1 / 7;

  for (const [week, v] of weekMap.entries()) {
    const load = v.km; // TSS simplificado = km
    ctl = ctl + (load - ctl) * ctlK * 7;
    atl = atl + (load - atl) * atlK * 7;
    fitnessHistory.push({
      date: week,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });
  }

  return (
    <ProgressCharts
      weeklyData={weeklyData}
      fitnessHistory={fitnessHistory}
      pacePoints={pacePoints}
      currentBrain={brain ? {
        ctl: brain.ctl ? Number(brain.ctl) : 0,
        atl: brain.atl ? Number(brain.atl) : 0,
        tsb: brain.tsb ? Number(brain.tsb) : 0,
      } : null}
    />
  );
}
