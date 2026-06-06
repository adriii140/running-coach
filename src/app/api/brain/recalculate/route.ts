import { NextResponse, NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { recalculateBrain } from "@/lib/brain/calculator";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await recalculateBrain(session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
