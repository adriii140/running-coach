import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

// GET /api/auth/callback?code=...
// Strava redirige aquí después de que el usuario autoriza
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/login?error=access_denied", req.url)
    );
  }

  // Intercambiar el código por tokens con Strava
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Strava token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(
      new URL("/login?error=token_exchange_failed", req.url)
    );
  }

  const tokenData = await tokenRes.json();
  const athlete = tokenData.athlete;

  if (!athlete?.id) {
    return NextResponse.redirect(
      new URL("/login?error=no_athlete", req.url)
    );
  }

  // Guardar/actualizar usuario en la base de datos
  const userId = `strava_${athlete.id}`;
  try {
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      stravaId: String(athlete.id),
      name: `${athlete.firstname} ${athlete.lastname}`.trim(),
      profileImageUrl: athlete.profile ?? null,
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiry: new Date(tokenData.expires_at * 1000),
    },
    update: {
      name: `${athlete.firstname} ${athlete.lastname}`.trim(),
      profileImageUrl: athlete.profile ?? null,
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiry: new Date(tokenData.expires_at * 1000),
    },
  });
  } catch (dbErr) {
    console.error("DB upsert error:", dbErr);
    return NextResponse.redirect(new URL("/login?error=db_error", req.url));
  }

  // Crear sesión JWT
  const sessionToken = await createSession({
    userId,
    stravaId: String(athlete.id),
    name: `${athlete.firstname} ${athlete.lastname}`.trim(),
    image: athlete.profile ?? "",
    stravaAccessToken: tokenData.access_token,
    stravaRefreshToken: tokenData.refresh_token,
    stravaTokenExpiry: tokenData.expires_at,
  });

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set(sessionCookieOptions(sessionToken));

  return response;
}
