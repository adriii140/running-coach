import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { recalculateBrain } from "@/lib/brain/calculator";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await recalculateBrain(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recalculate failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
