import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

// POST /api/brain/threshold — sobrescribe el ritmo umbral manualmente
// y recalcula las demás zonas a partir de él
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let thresholdSec: number;
  try {
    const body = await req.json();
    thresholdSec = Number(body.thresholdSec);
    if (!thresholdSec || thresholdSec < 180 || thresholdSec > 900) {
      throw new Error("Valor fuera de rango");
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Calcular zonas derivadas del umbral manual
  const zones = {
    paceThresholdSec: thresholdSec,
    paceTempoSec:     Math.round(thresholdSec * 1.04),
    paceAerobicSec:   Math.round(thresholdSec * 1.10),
    paceEasySec:      Math.round(thresholdSec * 1.20),
    paceRecoverySec:  Math.round(thresholdSec * 1.35),
  };

  await prisma.runningBrain.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...zones },
    update: zones,
  });

  return NextResponse.json({ ok: true, zones });
}
