// First-party route that sets the session cookie.
// Safari ITP allows cookies set here because the browser is already on our domain.
import { NextRequest, NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth/session";
import { consumePendingSession } from "@/lib/auth/pending-sessions";

export async function GET(req: NextRequest) {
  // Always redirect to the host the browser actually connected to
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const code = new URL(req.url).searchParams.get("c");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", baseUrl));
  }

  const token = consumePendingSession(code);

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=expired_code", baseUrl));
  }

  const response = NextResponse.redirect(new URL("/", baseUrl));
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
