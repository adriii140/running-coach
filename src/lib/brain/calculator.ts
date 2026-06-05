import { prisma } from "@/lib/db/prisma";
import { ActivityType } from "@prisma/client";
import { PR_DISTANCE_WINDOWS } from "@/types/brain.types";

// ─────────────────────────────────────────
// PUNTO DE ENTRADA PRINCIPAL
// ─────────────────────────────────────────

export async function recalculateBrain(userId: string): Promise<void> {
  const activities = await prisma.activity.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
  });

  const runActivities = activities.filter(
    (a) =>
      a.activityType === ActivityType.RUN ||
      a.activityType === ActivityType.TRAIL_RUN ||
      a.activityType === ActivityType.VIRTUAL_RUN
  );

  const strengthActivities = activities.filter(
    (a) => a.activityType === ActivityType.STRENGTH
  );

  const records = calculatePersonalRecords(runActivities);
  const paces = calculatePaceZones(records);
  const hrStats = calculateHRStats(runActivities);
  const load = calculateTrainingLoad(runActivities);
  const vo2max = estimateVO2max(records);

  // Estadísticas de fuerza
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const strengthMonth = strengthActivities.filter(
    (a) => a.startDate >= monthAgo
  ).length;
  const lastStrength = strengthActivities.at(-1)?.startDate ?? null;

  // Totales
  const totalDistanceKm = runActivities.reduce(
    (sum, a) => sum + (a.distance ?? 0) / 1000,
    0
  );
  const totalElevationM = runActivities.reduce(
    (sum, a) => sum + (a.totalElevation ?? 0),
    0
  );

  await prisma.runningBrain.upsert({
    where: { userId },
    create: {
      userId,
      ...records,
      ...paces,
      ...hrStats,
      ...load,
      vo2max,
      strengthSessionsMonth: strengthMonth,
      lastStrengthDate: lastStrength,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalActivities: runActivities.length,
      totalElevationM: Math.round(totalElevationM),
      totalStrengthSessions: strengthActivities.length,
    },
    update: {
      ...records,
      ...paces,
      ...hrStats,
      ...load,
      vo2max,
      strengthSessionsMonth: strengthMonth,
      lastStrengthDate: lastStrength,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalActivities: runActivities.length,
      totalElevationM: Math.round(totalElevationM),
      totalStrengthSessions: strengthActivities.length,
    },
  });
}

// ─────────────────────────────────────────
// RÉCORDS PERSONALES
// ─────────────────────────────────────────

type ActivityRow = {
  distance: number | null;
  movingTime: number;
  startDate: Date;
};

function calculatePersonalRecords(activities: ActivityRow[]) {
  const records: Record<string, number | null | Date> = {
    best1kSec: null, best1kDate: null,
    best3kSec: null, best3kDate: null,
    best5kSec: null, best5kDate: null,
    best10kSec: null, best10kDate: null,
    bestHalfSec: null, bestHalfDate: null,
    bestMarathonSec: null, bestMarathonDate: null,
  };

  for (const activity of activities) {
    if (!activity.distance || activity.movingTime <= 0) continue;

    const distM = activity.distance;

    for (const [key, window] of Object.entries(PR_DISTANCE_WINDOWS)) {
      if (distM < window.minM || distM > window.maxM) continue;

      // Calcular ritmo por km equivalente a la distancia del récord
      const targetDistM =
        key === "1k" ? 1000
        : key === "3k" ? 3000
        : key === "5k" ? 5000
        : key === "10k" ? 10000
        : key === "half" ? 21097
        : 42195;

      // Normalizar tiempo a la distancia objetivo (ritmo constante asumido)
      const secPerM = activity.movingTime / distM;
      const timeSec = Math.round(secPerM * targetDistM);

      const recordKey = `best${key.charAt(0).toUpperCase() + key.slice(1)}Sec`
        .replace("1kSec", "1kSec")
        .replace("3kSec", "3kSec")
        .replace("5kSec", "5kSec")
        .replace("10kSec", "10kSec")
        .replace("HalfSec", "HalfSec")
        .replace("MarathonSec", "MarathonSec");

      const dateKey = recordKey.replace("Sec", "Date");

      // Nombres explícitos para evitar errores de mapeo
      const secField = ({
        "1k": "best1kSec",
        "3k": "best3kSec",
        "5k": "best5kSec",
        "10k": "best10kSec",
        "half": "bestHalfSec",
        "marathon": "bestMarathonSec",
      } as Record<string, string>)[key];

      const dateField = ({
        "1k": "best1kDate",
        "3k": "best3kDate",
        "5k": "best5kDate",
        "10k": "best10kDate",
        "half": "bestHalfDate",
        "marathon": "bestMarathonDate",
      } as Record<string, string>)[key];

      const current = records[secField] as number | null;
      if (current === null || timeSec < current) {
        records[secField] = timeSec;
        records[dateField] = activity.startDate;
      }
    }
  }

  return records;
}

// ─────────────────────────────────────────
// ZONAS DE RITMO (fórmula Daniels VDOT)
// ─────────────────────────────────────────

function calculatePaceZones(records: Record<string, number | null | Date>) {
  // Usar el mejor 5K o 10K como referencia
  const ref5k = records.best5kSec as number | null;
  const ref10k = records.best10kSec as number | null;

  if (!ref5k && !ref10k) {
    return {
      paceRecoverySec: null,
      paceEasySec: null,
      paceAerobicSec: null,
      paceTempoSec: null,
      paceThresholdSec: null,
      paceRaceSec: null,
    };
  }

  // Ritmo umbral ≈ ritmo 10K * 1.045 (factor Daniels)
  let thresholdSecKm: number;
  if (ref10k) {
    const paceRef = ref10k / 10; // seg/km para 10K
    thresholdSecKm = Math.round(paceRef * 1.045);
  } else {
    const paceRef = ref5k! / 5;
    thresholdSecKm = Math.round(paceRef * 1.08);
  }

  return {
    paceThresholdSec: thresholdSecKm,
    paceTempoSec: Math.round(thresholdSecKm * 1.04),
    paceAerobicSec: Math.round(thresholdSecKm * 1.1),
    paceEasySec: Math.round(thresholdSecKm * 1.2),
    paceRecoverySec: Math.round(thresholdSecKm * 1.35),
    paceRaceSec: ref10k ? Math.round(ref10k / 10) : Math.round(ref5k! / 5),
  };
}

// ─────────────────────────────────────────
// ESTADÍSTICAS DE FRECUENCIA CARDÍACA
// ─────────────────────────────────────────

function calculateHRStats(activities: ActivityRow[]) {
  const withHR = activities.filter(
    (a): a is typeof a & { averageHeartrate: number } =>
      "averageHeartrate" in a && typeof (a as never as { averageHeartrate: unknown }).averageHeartrate === "number"
  );

  if (withHR.length === 0) {
    return {
      hrResting: null,
      hrAverage: null,
      hrMax: null,
      hrZone1Max: null,
      hrZone2Max: null,
      hrZone3Max: null,
      hrZone4Max: null,
      hrZone5Max: null,
    };
  }

  const avgs = withHR.map((a) => (a as unknown as { averageHeartrate: number }).averageHeartrate);
  const maxes = withHR.map((a) => (a as unknown as { maxHeartrate: number | null }).maxHeartrate ?? 0);

  const hrAverage = Math.round(avgs.reduce((s, v) => s + v, 0) / avgs.length);
  const hrMax = Math.max(...maxes);

  return {
    hrResting: null, // Se rellena desde el perfil del runner
    hrAverage,
    hrMax: hrMax > 0 ? hrMax : null,
    hrZone1Max: hrMax ? Math.round(hrMax * 0.60) : null,
    hrZone2Max: hrMax ? Math.round(hrMax * 0.70) : null,
    hrZone3Max: hrMax ? Math.round(hrMax * 0.80) : null,
    hrZone4Max: hrMax ? Math.round(hrMax * 0.90) : null,
    hrZone5Max: hrMax || null,
  };
}

// ─────────────────────────────────────────
// CARGA DE ENTRENAMIENTO (modelo Banister)
// ─────────────────────────────────────────

function calculateTrainingLoad(activities: ActivityRow[]) {
  const now = new Date();
  const sevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fortyTwoDays = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);

  // Calcular km equivalentes por período
  const weeklyKm = activities
    .filter((a) => a.startDate >= sevenDays)
    .reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0);

  const monthlyKm = activities
    .filter((a) => a.startDate >= thirtyDays)
    .reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0);

  // ATL: media exponencial ponderada 7 días (factor α = 2/8)
  const atl = calculateEWMA(activities, sevenDays, 7);

  // CTL: media exponencial ponderada 42 días (factor α = 2/43)
  const ctl = calculateEWMA(activities, fortyTwoDays, 42);

  const tsb = ctl - atl;

  return {
    ctl: Math.round(ctl * 10) / 10,
    atl: Math.round(atl * 10) / 10,
    tsb: Math.round(tsb * 10) / 10,
    weeklyLoadKm: Math.round(weeklyKm * 10) / 10,
    monthlyLoadKm: Math.round(monthlyKm * 10) / 10,
  };
}

function calculateEWMA(
  activities: ActivityRow[],
  since: Date,
  days: number
): number {
  const alpha = 2 / (days + 1);
  const recent = activities.filter((a) => a.startDate >= since);

  if (recent.length === 0) return 0;

  // Agrupar por día
  const dailyKm: Record<string, number> = {};
  for (const a of recent) {
    const day = a.startDate.toISOString().split("T")[0];
    dailyKm[day] = (dailyKm[day] ?? 0) + (a.distance ?? 0) / 1000;
  }

  const values = Object.values(dailyKm);
  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = alpha * values[i] + (1 - alpha) * ewma;
  }

  return ewma;
}

// ─────────────────────────────────────────
// VO2MAX ESTIMADO (fórmula Daniels simplificada)
// ─────────────────────────────────────────

function estimateVO2max(records: Record<string, number | null | Date>): number | null {
  const best5k = records.best5kSec as number | null;
  const best10k = records.best10kSec as number | null;

  const refTime = best5k ?? (best10k ? best10k / 2 : null);
  const refDist = best5k ? 5000 : 10000;

  if (!refTime) return null;

  // Fórmula Daniels: VO2max ≈ -4.6 + 0.182258 * (distM/timeSec*60) + 0.000104 * (distM/timeSec*60)^2
  const velocity = (refDist / refTime) * 60; // metros/min
  const vo2max = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;

  return Math.round(vo2max * 10) / 10;
}
