import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const type = searchParams.get("type");

  const where = {
    userId: session.user.id,
    ...(type ? { activityType: type as never } : {}),
  };

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { startDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        activityType: true,
        startDate: true,
        distance: true,
        movingTime: true,
        totalElevation: true,
        averageSpeed: true,
        averageHeartrate: true,
        hasHeartrate: true,
        mapPolyline: true,
        sufferScore: true,
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return NextResponse.json({
    activities,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
