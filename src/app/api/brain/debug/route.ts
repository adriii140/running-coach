import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStravaZones } from "@/lib/strava/client";
import { ensureFreshToken } from "@/lib/strava/sync";
import { ActivityType } from "@prisma/client";

// GET /api/brain/debug — muestra qué datos hay para calcular las zonas
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.stravaAccessToken) return NextResponse.json({ error: "No Strava" }, { status: 400 });

  const accessToken = await ensureFreshToken(user);

  // 1. Zonas de FC de Strava
  const stravaZones = await getStravaZones(accessToken);

  // 2. Actividades con FC en la BD
  const runsWithHR = await prisma.activity.findMany({
    where: {
      userId: session.userId,
      activityType: { in: [ActivityType.RUN, ActivityType.TRAIL_RUN, ActivityType.VIRTUAL_RUN] },
      averageHeartrate: { not: null },
    },
    select: { averageHeartrate: true, distance: true, movingTime: true, startDate: true },
    orderBy: { startDate: "desc" },
    take: 20,
  });

  // 3. Estado del brain actual
  const brain = await prisma.runningBrain.findUnique({
    where: { userId: session.userId },
    select: {
      paceThresholdSec: true, paceEasySec: true, paceRecoverySec: true,
      hrMax: true, best5kSec: true, best10kSec: true,
    },
  });

  // 4. Si hay zonas de FC, mostrar qué runs caen en Z4
  const hrZ4 = stravaZones?.heart_rate?.zones?.[3];
  const z4Runs = hrZ4 ? runsWithHR.filter(r =>
    (r.averageHeartrate ?? 0) >= hrZ4.min &&
    (r.averageHeartrate ?? 0) <= (hrZ4.max > 0 ? hrZ4.max : 999)
  ) : [];

  return NextResponse.json({
    stravaHRZones: stravaZones?.heart_rate?.zones ?? null,
    z4Range: hrZ4 ? `${hrZ4.min}–${hrZ4.max > 0 ? hrZ4.max : "∞"} bpm` : "no disponible",
    runsWithHRCount: runsWithHR.length,
    runsInZ4Count: z4Runs.length,
    runsInZ4Sample: z4Runs.slice(0, 5).map(r => ({
      hr: r.averageHeartrate,
      paceSecPerKm: r.distance ? Math.round(r.movingTime / (r.distance / 1000)) : null,
      date: r.startDate,
    })),
    currentBrain: brain,
  });
}
