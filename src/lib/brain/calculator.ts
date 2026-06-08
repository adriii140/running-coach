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
  const hrStats = calculateHRStats(runActivities);
  const paces = calculatePaceZones(records, runActivities, hrStats.hrMax);
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
  averageHeartrate?: number | null;
  maxHeartrate?: number | null;
};

// Factores de conversión de pace: si corres X km, tu mejor split de Y km
// equivale a tu pace * factor (Y < X → vas más rápido al acortar la distancia)
// Basado en la fórmula de Riegel: t2 = t1 * (d2/d1)^1.06
function riegelConvert(timeSec: number, fromDistM: number, toDistM: number): number {
  return Math.round(timeSec * Math.pow(toDistM / fromDistM, 1.06));
}

function calculatePersonalRecords(activities: ActivityRow[]) {
  const records: Record<string, number | null | Date> = {
    best1kSec: null, best1kDate: null,
    best3kSec: null, best3kDate: null,
    best5kSec: null, best5kDate: null,
    best10kSec: null, best10kDate: null,
    bestHalfSec: null, bestHalfDate: null,
    bestMarathonSec: null, bestMarathonDate: null,
  };

  // Targets: [targetDistM, secField, dateField, minSourceDistM]
  const TARGETS = [
    { distM: 1000,  secField: "best1kSec",      dateField: "best1kDate",      minSrcM: 900   },
    { distM: 3000,  secField: "best3kSec",       dateField: "best3kDate",      minSrcM: 2800  },
    { distM: 5000,  secField: "best5kSec",       dateField: "best5kDate",      minSrcM: 4500  },
    { distM: 10000, secField: "best10kSec",      dateField: "best10kDate",     minSrcM: 9000  },
    { distM: 21097, secField: "bestHalfSec",     dateField: "bestHalfDate",    minSrcM: 19000 },
    { distM: 42195, secField: "bestMarathonSec", dateField: "bestMarathonDate",minSrcM: 39000 },
  ];

  for (const activity of activities) {
    if (!activity.distance || activity.movingTime <= 0) continue;
    const distM = activity.distance;
    // Filtro de ritmo mínimo razonable (< 3:00/km es imposible, > 15:00/km es andar)
    const paceSecKm = (activity.movingTime / distM) * 1000;
    if (paceSecKm < 180 || paceSecKm > 900) continue;

    for (const target of TARGETS) {
      // La actividad debe tener al menos la distancia mínima para este target
      if (distM < target.minSrcM) continue;

      // Si la actividad es más larga que el target, aplicar corrección Riegel
      // Si es dentro del ±10% del target, usarla directamente (más preciso)
      let estimatedTime: number;
      if (distM >= target.distM * 0.90 && distM <= target.distM * 1.15) {
        // Actividad muy cercana a la distancia objetivo: normalizar directamente
        estimatedTime = Math.round((activity.movingTime / distM) * target.distM);
      } else {
        // Actividad más larga: estimar el split con Riegel
        estimatedTime = riegelConvert(activity.movingTime, distM, target.distM);
      }

      const current = records[target.secField] as number | null;
      if (current === null || estimatedTime < current) {
        records[target.secField] = estimatedTime;
        records[target.dateField] = activity.startDate;
      }
    }
  }

  return records;
}

// ─────────────────────────────────────────
// ZONAS DE RITMO (HR-based LTHR + Daniels fallback)
// ─────────────────────────────────────────

function calculatePaceZones(
  records: Record<string, number | null | Date>,
  activities: ActivityRow[],
  hrMax: number | null,
) {
  const ref5k  = records.best5kSec  as number | null;
  const ref10k = records.best10kSec as number | null;
  const refHalf = records.bestHalfSec as number | null;

  const nullResult = {
    paceRecoverySec: null, paceEasySec: null, paceAerobicSec: null,
    paceTempoSec: null, paceThresholdSec: null, paceRaceSec: null,
  };

  // ── Estrategia 1: LTHR desde FC ──────────────────────────────────────────
  if (hrMax && hrMax > 100) {
    const lthrMin = hrMax * 0.82;
    const lthrMax = hrMax * 0.92;
    const thresholdRuns = activities.filter((a) => {
      const hr = a.averageHeartrate ?? null;
      const distKm = (a.distance ?? 0) / 1000;
      return hr !== null && hr >= lthrMin && hr <= lthrMax && distKm >= 3;
    });
    if (thresholdRuns.length >= 2) {
      const sorted = thresholdRuns
        .slice().sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
        .slice(0, 10);
      const paces = sorted.map((a) => a.movingTime / ((a.distance ?? 1) / 1000));
      const thresholdSecKm = Math.round(paces.reduce((s, p) => s + p, 0) / paces.length);
      return buildPaceZones(thresholdSecKm, ref5k, ref10k);
    }
  }

  // ── Estrategia 2: Mejor ritmo de carreras largas recientes ───────────────
  // Usa runs ≥5km. Coge el percentil 10 más rápido (excluye picos anómalos)
  // y asume que eso es cercano al umbral real.
  const longRuns = activities
    .filter((a) => (a.distance ?? 0) >= 5000 && a.movingTime > 0)
    .map((a) => ({ pace: a.movingTime / ((a.distance ?? 1) / 1000), date: a.startDate }))
    .filter((a) => a.pace > 120 && a.pace < 800) // entre 2:00 y 13:20 /km
    .sort((a, b) => a.pace - b.pace); // más rápido primero

  if (longRuns.length >= 3) {
    // Percentil 20 más rápido: representa esfuerzo alto pero no máximo
    const p20idx = Math.max(0, Math.floor(longRuns.length * 0.20) - 1);
    const fastPace = longRuns[p20idx].pace;
    // El umbral ≈ ritmo del 20% más rápido de tus runs largos
    const thresholdSecKm = Math.round(fastPace);
    return buildPaceZones(thresholdSecKm, ref5k, ref10k);
  }

  // ── Estrategia 3: desde el mejor PR disponible (modelo Strava) ──────────
  // Strava: umbral ≈ 0.93x ritmo_5k (Z4), Z3 ≈ 1.00x ritmo_5k
  // Es decir: umbral es MÁS RÁPIDO que el ritmo de carrera en 5K
  if (!ref5k && !ref10k && !refHalf) return nullResult;

  let pace5kSecPerKm: number;
  if (ref5k) {
    pace5kSecPerKm = ref5k / 5;
  } else if (ref10k) {
    pace5kSecPerKm = (ref10k / 10) * 0.93; // 5K ≈ 7% más rápido que 10K
  } else {
    pace5kSecPerKm = (refHalf! / 21.097) * 0.87; // 5K ≈ 13% más rápido que media
  }

  // Z4 bottom (threshold) = 93% del ritmo 5K (más rápido → menos segundos/km)
  const thresholdSecKm = Math.round(pace5kSecPerKm * 0.93);

  return buildPaceZones(thresholdSecKm, ref5k, ref10k);
}

function buildPaceZones(
  thresholdSecKm: number,  // Z4 bottom = 0.93x pace_5K
  ref5k: number | null,
  ref10k: number | null,
) {
  // Reconstruir el ritmo de 5K desde el umbral para derivar el resto
  const pace5k = thresholdSecKm / 0.93;
  return {
    paceThresholdSec: thresholdSecKm,              // Z4 ≈ <5K pace
    paceTempoSec:     Math.round(pace5k),           // Z3 top ≈ 5K pace
    paceAerobicSec:   Math.round(pace5k * 1.10),   // Z3/Z2 boundary
    paceEasySec:      Math.round(pace5k * 1.28),   // Z2/Z1 boundary
    paceRecoverySec:  Math.round(pace5k * 1.42),   // Z1
    paceRaceSec: ref10k
      ? Math.round(ref10k / 10)
      : ref5k
        ? Math.round(ref5k / 5)
        : null,
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
