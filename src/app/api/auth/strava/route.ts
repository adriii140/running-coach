import { NextResponse } from "next/server";

// GET /api/auth/strava → redirige a Strava para autorización
export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all,profile:read_all",
  });

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params}`
  );
}
