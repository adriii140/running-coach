import { NextResponse, NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { recalculateBrain } from "@/lib/brain/calculator";
import { ensureFreshToken, deriveZonesFromStravaHRPublic, syncBestEfforts } from "@/lib/strava/sync";
import { prisma } from "@/lib/db/prisma";
import { ActivityType } from "@prisma/client";

// Tipos que NO queremos en la BD
const EXCLUDED_TYPES: ActivityType[] = [ActivityType.WALKING, ActivityType.OTHER];

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Borrar actividades no deseadas (caminatas, etc.)
    const deleted = await prisma.activity.deleteMany({
      where: { userId: session.userId, activityType: { in: EXCLUDED_TYPES } },
    });

    // 2. Recalcular brain (PRs, carga, VO2max)
    await recalculateBrain(session.userId);

    // 3. PRs reales y zonas desde Strava (si hay credenciales)
    try {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (user?.stravaAccessToken) {
        const accessToken = await ensureFreshToken(user);
        await syncBestEfforts(session.userId, accessToken, 10); // últimas 10 actividades
        await recalculateBrain(session.userId); // recalcular con los PRs actualizados
        await deriveZonesFromStravaHRPublic(session.userId, accessToken);
      }
    } catch (e) {
      console.error("[recalculate] Error syncing from Strava:", e);
    }

    return NextResponse.json({ ok: true, deletedUnwanted: deleted.count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
