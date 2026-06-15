import { prisma } from "@/lib/db/prisma";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
import { refreshStravaToken, fetchAllStravaActivities, getStravaActivity, getStravaZones } from "./client";
import { transformStravaActivity, mapStravaType } from "./transform";
import { recalculateBrain } from "@/lib/brain/calculator";
import { ActivityType } from "@prisma/client";
import type { User } from "@prisma/client";

// Tipos de actividad que se importan (solo running + fuerza)
const ALLOWED_TYPES = new Set<ActivityType>([
  ActivityType.RUN,
  ActivityType.TRAIL_RUN,
  ActivityType.VIRTUAL_RUN,
  ActivityType.STRENGTH,
  ActivityType.CYCLING,
  ActivityType.SWIMMING,
]);

function shouldImport(stravaType: string): boolean {
  return ALLOWED_TYPES.has(mapStravaType(stravaType));
}

export type SyncResult = {
  synced: number;
  skipped: number;
  errors: number;
  message: string;
};

// Refresca el token de Strava si está próximo a expirar (< 5 min)
export async function ensureFreshToken(user: User): Promise<string> {
  const expiresAt = user.stravaTokenExpiry?.getTime() ?? 0;
  const nowMs = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt - nowMs > fiveMinutes) {
    return user.stravaAccessToken!;
  }

  const refreshed = await refreshStravaToken(user.stravaRefreshToken!);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stravaAccessToken: refreshed.access_token,
      stravaRefreshToken: refreshed.refresh_token,
      stravaTokenExpiry: new Date(refreshed.expires_at * 1000),
    },
  });

  return refreshed.access_token;
}

// Deriva el ritmo umbral usando las zonas de FC de Strava + las actividades de la BD.
// Strava API devuelve FC zones (no pace zones). Buscamos runs donde la FC media
// estuvo en la zona 4 (umbral) y calculamos su ritmo promedio.
export { deriveZonesFromStravaHR as deriveZonesFromStravaHRPublic };
export { syncBestEfforts };

// Mapeo nombre Strava → campo en RunningBrain
const EFFORT_MAP: Record<string, { secField: string; dateField: string }> = {
  "1k":            { secField: "best1kSec",      dateField: "best1kDate"      },
  "5k":            { secField: "best5kSec",       dateField: "best5kDate"      },
  "10k":           { secField: "best10kSec",      dateField: "best10kDate"     },
  "half-marathon": { secField: "bestHalfSec",     dateField: "bestHalfDate"    },
  "marathon":      { secField: "bestMarathonSec", dateField: "bestMarathonDate"},
};

async function syncBestEfforts(userId: string, accessToken: string, limit = 50): Promise<void> {
  const recentRuns = await prisma.activity.findMany({
    where: {
      userId,
      activityType: { in: [ActivityType.RUN, ActivityType.TRAIL_RUN, ActivityType.VIRTUAL_RUN] },
    },
    orderBy: { startDate: "desc" },
    take: limit,
    select: { stravaId: true },
  });

  // Inicializar con los PRs actuales de la BD
  const brain = await prisma.runningBrain.findUnique({ where: { userId } });

  // best[effortName] = { sec, date } del mejor encontrado hasta ahora
  const best: Record<string, { sec: number; date: string }> = {};
  for (const [name, mapping] of Object.entries(EFFORT_MAP)) {
    const sec = brain?.[mapping.secField as keyof typeof brain] as number | null;
    if (sec) best[name] = { sec, date: "" };
  }

  let fetched = 0;
  for (const run of recentRuns) {
    try {
      const detail = await getStravaActivity(accessToken, Number(run.stravaId));
      fetched++;

      const efforts = detail.best_efforts ?? [];
      if (fetched === 1) {
        // Log de diagnóstico solo para la primera actividad
        console.log(`[PRs debug] Primera actividad ${run.stravaId}: ${efforts.length} best_efforts`, efforts.map(e => `${e.name}=${e.elapsed_time}s`));
      }

      for (const effort of efforts) {
        const mapping = EFFORT_MAP[effort.name];
        if (!mapping) continue;

        const prev = best[effort.name];
        if (!prev || effort.elapsed_time < prev.sec) {
          best[effort.name] = { sec: effort.elapsed_time, date: effort.start_date };
        }
      }

      await delay(300);
    } catch {
      // ignorar errores individuales de red
    }
  }

  // Solo guardar los que mejoran los PRs actuales de la BD
  const updates: Record<string, number | Date | null> = {};
  for (const [name, mapping] of Object.entries(EFFORT_MAP)) {
    const found = best[name];
    if (!found?.date) continue; // no se encontró en ninguna actividad
    const currentSec = brain?.[mapping.secField as keyof typeof brain] as number | null;
    if (!currentSec || found.sec < currentSec) {
      updates[mapping.secField] = found.sec;
      updates[mapping.dateField] = new Date(found.date);
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.runningBrain.upsert({
      where: { userId },
      create: { userId, ...updates },
      update: updates,
    });
    const summary = Object.entries(updates)
      .filter(([k]) => k.endsWith("Sec"))
      .map(([k, v]) => {
        const sec = v as number;
        return `${k.replace("best","").replace("Sec","")}: ${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;
      }).join(", ");
    console.log(`[PRs] Actualizados desde Strava: ${summary}`);
  } else {
    console.log(`[PRs] Sin mejoras en PRs tras revisar ${fetched} actividades`);
  }
}
async function deriveZonesFromStravaHR(userId: string, accessToken: string): Promise<boolean> {
  try {
    const zones = await getStravaZones(accessToken);
    const hrZones = zones?.heart_rate?.zones;
    if (!hrZones || hrZones.length < 4) return false;

    // Zona 4 (índice 3) = zona umbral en el modelo Strava de 5 zonas
    // min/max en bpm; max=-1 significa "sin límite"
    const z4 = hrZones[3];
    const z4min = z4.min;
    const z4max = z4.max > 0 ? z4.max : z4.min + 25;

    // Buscar runs de la BD donde la FC media estuvo en Z4
    const thresholdRuns = await prisma.activity.findMany({
      where: {
        userId,
        activityType: { in: [ActivityType.RUN, ActivityType.TRAIL_RUN, ActivityType.VIRTUAL_RUN] },
        averageHeartrate: { gte: z4min, lte: z4max },
        distance: { gte: 3000 }, // al menos 3 km para excluir series cortas
      },
      select: { distance: true, movingTime: true },
      orderBy: { startDate: "desc" },
      take: 15, // últimas 15 actividades en zona umbral
    });

    if (thresholdRuns.length < 2) return false;

    // Ritmo medio de esas actividades en seg/km
    const paces = thresholdRuns.map((a) => a.movingTime / ((a.distance ?? 1) / 1000));
    const medianPace = paces.sort((a, b) => a - b)[Math.floor(paces.length / 2)];
    const thresholdSec = Math.round(medianPace);

    // Sanity check: el umbral debe estar entre 3:00 y 10:00 /km
    if (thresholdSec < 180 || thresholdSec > 600) return false;

    const paceData = {
      paceThresholdSec: thresholdSec,
      paceTempoSec:     Math.round(thresholdSec * 1.04),
      paceAerobicSec:   Math.round(thresholdSec * 1.10),
      paceEasySec:      Math.round(thresholdSec * 1.20),
      paceRecoverySec:  Math.round(thresholdSec * 1.35),
    };

    await prisma.runningBrain.upsert({
      where: { userId },
      create: { userId, ...paceData },
      update: paceData,
    });

    console.log(`[zones] Umbral derivado de FC Z4 (${z4min}-${z4max} bpm): ${Math.floor(thresholdSec/60)}:${String(thresholdSec%60).padStart(2,"0")}/km (n=${thresholdRuns.length})`);
    return true;
  } catch (err) {
    console.error("Error deriving zones from HR:", err);
    return false;
  }
}

// Sincronización completa (todas las actividades del usuario)
export async function fullSync(userId: string): Promise<SyncResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.stravaAccessToken || !user.stravaRefreshToken) {
    return { synced: 0, skipped: 0, errors: 0, message: "No Strava credentials" };
  }

  const accessToken = await ensureFreshToken(user);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  const activities = await fetchAllStravaActivities(accessToken);

  for (const activity of activities) {
    // Ignorar caminatas y actividades no relevantes
    if (!shouldImport(activity.sport_type || activity.type)) {
      skipped++;
      continue;
    }

    try {
      const stravaId = String(activity.id);
      const existing = await prisma.activity.findUnique({ where: { stravaId } });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.activity.create({
        data: transformStravaActivity(activity, userId),
      });

      synced++;
    } catch {
      errors++;
    }
  }

  // Orden correcto: PRs primero → recalcular con PRs reales → zonas FC si hay datos
  await syncBestEfforts(userId, accessToken);         // PRs reales desde Strava
  await recalculateBrain(userId);                     // zonas usando best5kSec actualizado
  await deriveZonesFromStravaHR(userId, accessToken); // override con FC si hay datos
  if (synced > 0) await autoLinkActivitiesToPlan(userId);

  return {
    synced,
    skipped,
    errors,
    message: `Sincronizadas ${synced} actividades. ${skipped} ya existían.`,
  };
}

// Sincronización incremental (solo nuevas desde la última actividad guardada)
export async function incrementalSync(userId: string): Promise<SyncResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.stravaAccessToken || !user.stravaRefreshToken) {
    return { synced: 0, skipped: 0, errors: 0, message: "No Strava credentials" };
  }

  // Obtener la actividad más reciente guardada
  const latest = await prisma.activity.findFirst({
    where: { userId },
    orderBy: { startDate: "desc" },
    select: { startDate: true },
  });

  const accessToken = await ensureFreshToken(user);

  // Pedir solo actividades posteriores a la última guardada
  const afterTimestamp = latest
    ? Math.floor(latest.startDate.getTime() / 1000)
    : undefined;

  const activities = await fetchAllStravaActivities(accessToken, {
    after: afterTimestamp,
  });

  let synced = 0;
  let errors = 0;

  for (const activity of activities) {
    // Ignorar caminatas y actividades no relevantes
    if (!shouldImport(activity.sport_type || activity.type)) continue;

    try {
      await prisma.activity.upsert({
        where: { stravaId: String(activity.id) },
        create: transformStravaActivity(activity, userId),
        update: transformStravaActivity(activity, userId),
      });
      synced++;
    } catch {
      errors++;
    }
  }

  // PRs de últimas 5 actividades + recalcular + zonas FC
  await syncBestEfforts(userId, accessToken, 5);
  await recalculateBrain(userId);
  await deriveZonesFromStravaHR(userId, accessToken);
  if (synced > 0) await autoLinkActivitiesToPlan(userId);

  return {
    synced,
    skipped: 0,
    errors,
    message: synced > 0
      ? `${synced} nuevas actividades sincronizadas.`
      : "Todo al día. PRs y zonas actualizados.",
  };
}

// Auto-link activities to planned sessions by date match
async function autoLinkActivitiesToPlan(userId: string): Promise<void> {
  try {
    // Find pending sessions in active plans
    const pendingSessions = await prisma.plannedSession.findMany({
      where: {
        completed: false,
        skipped: false,
        plan: { userId, status: "ACTIVE" },
        type: { not: "REST" },
      },
      select: { id: true, date: true, type: true },
    });

    if (pendingSessions.length === 0) return;

    // For each pending session, check if there's a matching activity on the same day
    for (const ps of pendingSessions) {
      const dayStart = new Date(ps.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(ps.date);
      dayEnd.setHours(23, 59, 59, 999);

      const activity = await prisma.activity.findFirst({
        where: {
          userId,
          startDate: { gte: dayStart, lte: dayEnd },
          activityType: { in: [ActivityType.RUN, ActivityType.TRAIL_RUN, ActivityType.VIRTUAL_RUN, ActivityType.STRENGTH, ActivityType.CYCLING] },
        },
        select: { id: true },
      });

      if (activity) {
        await prisma.plannedSession.update({
          where: { id: ps.id },
          data: { completed: true, activityId: activity.id },
        });
      }
    }
  } catch {
    // Non-critical — don't fail sync if auto-link fails
  }
}

// Sincronización de una sola actividad (trigger de webhook)
export async function syncSingleActivity(
  userId: string,
  stravaActivityId: number
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stravaAccessToken) return;

  const accessToken = await ensureFreshToken(user);

  try {
    const activity = await getStravaActivity(accessToken, stravaActivityId);

    await prisma.activity.upsert({
      where: { stravaId: String(activity.id) },
      create: transformStravaActivity(activity, userId),
      update: transformStravaActivity(activity, userId),
    });

    await recalculateBrain(userId);
  } catch (err) {
    console.error(`Error syncing activity ${stravaActivityId}:`, err);
  }
}

// Eliminar actividad sincronizada (cuando Strava avisa de borrado)
export async function deleteActivity(stravaActivityId: number): Promise<void> {
  await prisma.activity.deleteMany({
    where: { stravaId: String(stravaActivityId) },
  });
}
