import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { RouteType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, distanceKm, durationMin, elevationM, elevationLossM, geometry, startLat, startLng, surface, routeType } = body;

    if (!geometry || !startLat || !startLng) {
      return NextResponse.json({ error: "Faltan datos de la ruta" }, { status: 400 });
    }

    const typeMap: Record<string, RouteType> = {
      loop: RouteType.CIRCULAR,
      outback: RouteType.OUT_AND_BACK,
    };

    const saved = await prisma.generatedRoute.create({
      data: {
        userId: session.userId,
        name: name || `Ruta ${new Date().toLocaleDateString("es-ES")}`,
        distanceKm: distanceKm ?? 0,
        durationMin: durationMin ?? 0,
        elevationM: elevationM ?? 0,
        type: typeMap[routeType] ?? RouteType.CIRCULAR,
        startLat,
        startLng,
        geometry,
        surface: surface ?? "asphalt",
        notes: elevationLossM ? `D-: ${elevationLossM}m` : null,
      },
    });

    return NextResponse.json({ ok: true, id: saved.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
