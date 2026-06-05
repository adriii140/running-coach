import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { fullSync, incrementalSync } from "@/lib/strava/sync";

// POST /api/strava/sync?type=full|incremental
export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "incremental";

  try {
    const result =
      type === "full"
        ? await fullSync(session.user.id)
        : await incrementalSync(session.user.id);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
