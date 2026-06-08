import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const routes = await prisma.generatedRoute.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      distanceKm: true,
      durationMin: true,
      elevationM: true,
      type: true,
      startLat: true,
      startLng: true,
      geometry: true,
      surface: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ routes });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  await prisma.generatedRoute.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ ok: true });
}
