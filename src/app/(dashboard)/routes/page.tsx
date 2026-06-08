import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RouteGeneratorMapLoader } from "@/components/routes/RouteGeneratorMapLoader";
import { prisma } from "@/lib/db/prisma";
export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hasORS = !!process.env.OPENROUTESERVICE_API_KEY;

  // Última ubicación de inicio de carrera para centrar el mapa
  const lastRun = await prisma.activity.findFirst({
    where: {
      userId: session.userId,
      activityType: { in: ["RUN", "TRAIL_RUN", "VIRTUAL_RUN"] },
      startLat: { not: null },
      startLng: { not: null },
    },
    orderBy: { startDate: "desc" },
    select: { startLat: true, startLng: true },
  });

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generador de rutas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            El Coach AI analiza tu forma y genera la ruta perfecta para hoy
          </p>
        </div>
        {!hasORS && (
          <a
            href="https://openrouteservice.org/dev/#/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            ⚠ Configura ORS API key
          </a>
        )}
      </div>
      <RouteGeneratorMapLoader
        lastRunLat={lastRun?.startLat ?? null}
        lastRunLng={lastRun?.startLng ?? null}
      />
    </div>
  );
}
