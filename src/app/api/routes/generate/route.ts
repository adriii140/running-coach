import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateRoute } from "@/lib/routes/generator";
import { streamFromModel, getDefaultModelId } from "@/lib/ai/client";
import { buildCoachSystemPrompt } from "@/lib/ai/coach-prompt";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    lat, lng, distanceKm, askAI,
    preference, avoidFeatures, maxElevationGainM, boundingPolygon, seed,
  } = body;

  if (!lat || !lng || !distanceKm) {
    return NextResponse.json({ error: "lat, lng y distanceKm son obligatorios" }, { status: 400 });
  }

  // Consulta opcional al Coach AI sobre qué tipo de entrenamiento hacer
  let aiRecommendation: string | null = null;
  if (askAI) {
    try {
      const [brain, activities] = await Promise.all([
        prisma.runningBrain.findUnique({ where: { userId: session.userId } }),
        prisma.activity.findMany({
          where: { userId: session.userId },
          orderBy: { startDate: "desc" },
          take: 10,
          select: { name: true, activityType: true, startDate: true, distance: true, movingTime: true, totalElevation: true, averageHeartrate: true },
        }),
      ]);

      const systemPrompt = buildCoachSystemPrompt({ name: session.name, brain, recentActivities: activities });
      const { stream: aiStream } = await streamFromModel(getDefaultModelId(), [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Voy a salir a correr ${distanceKm} km ahora mismo. Basándote en mi historial y estado de forma actual (CTL/ATL/TSB), dame una recomendación breve (2-3 frases) sobre a qué ritmo debería correr y qué tipo de entrenamiento es más adecuado para hoy. Sé muy conciso y directo.`,
        },
      ]);

      const reader = aiStream.getReader();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
      }
      aiRecommendation = text;
    } catch (e) {
      console.error("AI recommendation error:", e);
    }
  }

  // Generar la ruta con ORS (5 candidatos en paralelo, elige el mejor)
  try {
    const route = await generateRoute({
      startLat: parseFloat(lat),
      startLng: parseFloat(lng),
      distanceKm: parseFloat(distanceKm),
      preference: preference ?? "recommended",
      avoidFeatures: avoidFeatures ?? [],
      maxElevationGainM: maxElevationGainM ?? undefined,
      boundingPolygon: boundingPolygon ?? undefined,
      seed: seed ?? undefined,
    });

    // Guardar en DB
    const savedRoute = await prisma.generatedRoute.create({
      data: {
        userId: session.userId,
        name: `Ruta ${route.distanceKm} km — ${new Date().toLocaleDateString("es-ES")}`,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        elevationM: route.elevationM,
        type: "CIRCULAR",
        startLat: parseFloat(lat),
        startLng: parseFloat(lng),
        geometry: route.geometry as never,
        waypoints: route.waypoints as never,
        notes: aiRecommendation ?? undefined,
      },
    });

    return NextResponse.json({ route, savedRoute, aiRecommendation });
  } catch (err) {
    console.error("Route generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error generando ruta" },
      { status: 500 }
    );
  }
}
