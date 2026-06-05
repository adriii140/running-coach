import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";

// Provider OAuth personalizado para Strava
const StravaProvider = {
  id: "strava",
  name: "Strava",
  type: "oauth" as const,
  authorization: {
    url: "https://www.strava.com/oauth/authorize",
    params: {
      scope: "read,activity:read_all,profile:read_all",
      approval_prompt: "auto",
    },
  },
  token: "https://www.strava.com/oauth/token",
  userinfo: "https://www.strava.com/api/v3/athlete",
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  profile(profile: {
    id: number;
    firstname: string;
    lastname: string;
    email?: string;
    profile: string;
  }) {
    return {
      id: String(profile.id),
      name: `${profile.firstname} ${profile.lastname}`.trim(),
      email: profile.email ?? null,
      image: profile.profile,
      stravaId: String(profile.id),
    };
  },
};

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
  providers: [StravaProvider],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as unknown as {
          id: number;
          firstname: string;
          lastname: string;
          profile: string;
        };

        // Guardar tokens de Strava en el JWT
        token.stravaId = String(p.id);
        token.stravaAccessToken = account.access_token;
        token.stravaRefreshToken = account.refresh_token;
        token.stravaTokenExpiry = account.expires_at
          ? new Date(account.expires_at * 1000)
          : null;

        // Sincronizar usuario en BD con datos de Strava
        await prisma.user.upsert({
          where: { stravaId: String(p.id) },
          create: {
            stravaId: String(p.id),
            name: `${p.firstname} ${p.lastname}`.trim(),
            profileImageUrl: p.profile,
            stravaAccessToken: account.access_token ?? null,
            stravaRefreshToken: (account.refresh_token as string) ?? null,
            stravaTokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
          update: {
            stravaAccessToken: account.access_token ?? null,
            stravaRefreshToken: (account.refresh_token as string) ?? null,
            stravaTokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
        });

        // Obtener el id de nuestra BD
        const user = await prisma.user.findUnique({
          where: { stravaId: String(p.id) },
          select: { id: true },
        });
        token.userId = user?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.stravaId = token.stravaId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
