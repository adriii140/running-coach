import { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      stravaId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: string;
    stravaId?: string;
    stravaAccessToken?: string;
    stravaRefreshToken?: string;
    stravaTokenExpiry?: Date | null;
  }
}
