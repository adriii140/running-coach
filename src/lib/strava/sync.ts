import { prisma } from "@/lib/db/prisma";
import { refreshStravaToken, fetchAllStravaActivities, getStravaActivity } from "./client";
import { transformStravaActivity } from "./transform";
import { recalculateBrain } from "@/lib/brain/calculator";
import type { User } from "@prisma/client";

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

  // Recalcular el brain después de la sincronización
  if (synced > 0) {
    await recalculateBrain(userId);
  }

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

  if (synced > 0) {
    await recalculateBrain(userId);
  }

  return {
    synced,
    skipped: 0,
    errors,
    message: synced > 0
      ? `${synced} nuevas actividades sincronizadas.`
      : "Todo al día. No hay nuevas actividades.",
  };
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
