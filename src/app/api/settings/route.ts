import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.settings.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId },
    update: {},
  });

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    unitSystem,
    timezone,
    weekStartsOn,
    homeLocationName,
    homeLocationLat,
    homeLocationLng,
    autoSync,
    aiProvider,
    aiModel,
  } = body;

  const data: Record<string, unknown> = {};
  if (unitSystem !== undefined) data.unitSystem = unitSystem;
  if (timezone !== undefined) data.timezone = timezone;
  if (weekStartsOn !== undefined) data.weekStartsOn = Number(weekStartsOn);
  if (homeLocationName !== undefined) data.homeLocationName = homeLocationName;
  if (homeLocationLat !== undefined) data.homeLocationLat = homeLocationLat === null ? null : Number(homeLocationLat);
  if (homeLocationLng !== undefined) data.homeLocationLng = homeLocationLng === null ? null : Number(homeLocationLng);
  if (autoSync !== undefined) data.autoSync = Boolean(autoSync);
  if (aiProvider !== undefined) data.aiProvider = aiProvider;
  if (aiModel !== undefined) data.aiModel = aiModel;

  const settings = await prisma.settings.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...data },
    update: data,
  });

  return NextResponse.json({ settings });
}

export { POST as PATCH };
