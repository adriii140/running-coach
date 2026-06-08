import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

// POST /api/events/extract — lee una URL de carrera y extrae los datos con IA
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

  // 1. Fetch the page content
  let pageText = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RunCoachBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Strip HTML tags to get readable text (simple regex)
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000); // Limit to avoid token overflow
  } catch {
    return NextResponse.json({ error: "No se pudo acceder a la página" }, { status: 422 });
  }

  // 2. Call AI to extract structured info
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.GROQ_API_KEY;
  const isGroq = !process.env.OPENROUTER_API_KEY && !!process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "No hay API de IA configurada" }, { status: 503 });
  }

  const systemPrompt = `Eres un extractor de datos de carreras de running/trail.
Extrae del texto la información de la carrera y devuelve SOLO un JSON válido sin texto adicional con estos campos (usa null si no está disponible):
{
  "name": "nombre de la carrera",
  "eventType": "ROAD_RACE|TRAIL_RACE|RELAY|TRIATHLON|OBSTACLE|VIRTUAL|FUN_RUN|CUSTOM",
  "date": "YYYY-MM-DD",
  "distanceKm": number | null,
  "city": "ciudad" | null,
  "country": "país" | null,
  "elevationGain": number | null,
  "price": number | null,
  "notes": "información relevante sobre la carrera" | null
}`;

  try {
    const aiRes = await fetch(
      isGroq
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(isGroq ? {} : {
            "HTTP-Referer": "https://runcoach.local",
            "X-Title": "RunCoach AI",
          }),
        },
        body: JSON.stringify({
          model: isGroq ? "llama-3.1-8b-instant" : "meta-llama/llama-3.1-8b-instruct:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `URL: ${url}\n\nContenido de la página:\n${pageText}` },
          ],
          temperature: 0.1,
          max_tokens: 512,
        }),
      }
    );

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";

    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const extracted = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ data: extracted });
  } catch {
    return NextResponse.json({ error: "No se pudieron extraer los datos" }, { status: 422 });
  }
}
