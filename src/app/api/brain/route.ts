import { NextResponse, NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brain = await prisma.runningBrain.findUnique({ where: { userId: session.userId } });
  return NextResponse.json(brain ?? null);
}
