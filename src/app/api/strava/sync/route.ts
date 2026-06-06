import { NextResponse, NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { fullSync, incrementalSync } from "@/lib/strava/sync";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "incremental";

  try {
    const result = type === "full"
      ? await fullSync(session.userId)
      : await incrementalSync(session.userId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
