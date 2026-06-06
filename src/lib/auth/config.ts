import type { NextAuthConfig } from "next-auth";

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
  // Strava incluye el objeto "athlete" en la respuesta del token,
  // lo que no cumple el estándar OAuth 2.0 y openid-client lo rechaza.
  // conform() normaliza la respuesta antes de que la librería la procese.
  token: {
    url: "https://www.strava.com/oauth/token",
    conform: async (response: Response) => {
      const data = await response.json() as Record<string, unknown>;
      // Eliminar el campo no-estándar "athlete" de la respuesta
      const { athlete: _athlete, ...tokenData } = data;
      return new Response(JSON.stringify(tokenData), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
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
    };
  },
};

const isDatabaseConfigured =
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("placeholder");

export const authConfig: NextAuthConfig = {
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

        token.stravaId = String(p.id);
        token.stravaAccessToken = account.access_token;
        token.stravaRefreshToken = account.refresh_token;
        token.stravaTokenExpiry = account.expires_at
          ? new Date(account.expires_at * 1000)
          : null;

        if (isDatabaseConfigured) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { prisma } = require("@/lib/db/prisma");
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
            const user = await prisma.user.findUnique({
              where: { stravaId: String(p.id) },
              select: { id: true },
            });
            token.userId = user?.id;
          } catch (err) {
            console.error("DB sync error (non-fatal):", err);
            token.userId = `strava_${p.id}`;
          }
        } else {
          token.userId = `strava_${p.id}`;
        }
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
