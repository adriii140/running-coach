import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_COOKIE = "rc_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "fallback-secret-change-in-production"
);

export interface SessionData {
  userId: string;
  stravaId: string;
  name: string;
  image: string;
  stravaAccessToken: string;
  stravaRefreshToken: string;
  stravaTokenExpiry: number; // unix timestamp en segundos
}

export async function createSession(data: SessionData): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionData | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
