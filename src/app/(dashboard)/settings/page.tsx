import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

function isConfigured(value: string | undefined): boolean {
  return !!value && value.length > 0 && !value.includes("placeholder");
}

const DEFAULT_SETTINGS = {
  unitSystem: "metric",
  timezone: "Europe/Madrid",
  weekStartsOn: 1,
  homeLocationName: null,
  homeLocationLat: null,
  homeLocationLng: null,
  autoSync: true,
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [dbUser, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, profileImageUrl: true, stravaAccessToken: true },
    }),
    prisma.settings.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId },
      update: {},
    }).catch(() => null),
  ]);

  const user = {
    name: dbUser?.name ?? session.name ?? "",
    email: dbUser?.email ?? null,
    image: dbUser?.profileImageUrl ?? session.image,
    stravaConnected: !!dbUser?.stravaAccessToken,
  };

  const s = settings ?? DEFAULT_SETTINGS;
  const settingsProps = {
    unitSystem: s.unitSystem,
    timezone: s.timezone,
    weekStartsOn: s.weekStartsOn,
    homeLocationName: s.homeLocationName,
    homeLocationLat: s.homeLocationLat,
    homeLocationLng: s.homeLocationLng,
    autoSync: s.autoSync,
  };

  const envStatus = {
    groq: isConfigured(process.env.GROQ_API_KEY),
    gemini: isConfigured(process.env.GEMINI_API_KEY),
    openrouter: isConfigured(process.env.OPENROUTER_API_KEY),
    ors: isConfigured(process.env.OPENROUTESERVICE_API_KEY),
  };

  return (
    <SettingsClient
      user={user}
      settings={settingsProps}
      envStatus={envStatus}
    />
  );
}
