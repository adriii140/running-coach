import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brain = await prisma.runningBrain.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(brain ?? null);
}
