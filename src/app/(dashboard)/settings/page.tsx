import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

function isConfigured(value: string | undefined): boolean {
  return !!value && value.length > 0 && !value.includes("placeholder");
}

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
    }),
  ]);

  const user = {
    name: dbUser?.name ?? session.name ?? "",
    email: dbUser?.email ?? null,
    image: dbUser?.profileImageUrl ?? session.image,
    stravaConnected: !!dbUser?.stravaAccessToken,
  };

  const settingsProps = {
    unitSystem: settings.unitSystem,
    timezone: settings.timezone,
    weekStartsOn: settings.weekStartsOn,
    homeLocationName: settings.homeLocationName,
    homeLocationLat: settings.homeLocationLat,
    homeLocationLng: settings.homeLocationLng,
    autoSync: settings.autoSync,
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
