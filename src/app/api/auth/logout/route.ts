import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.set(clearSessionCookie());
  return response;
}
