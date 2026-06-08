import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { BrainStats } from "@/components/dashboard/BrainStats";
import { ThresholdOverride } from "@/components/dashboard/ThresholdOverride";

export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isDatabaseConfigured =
    !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder");

  if (!isDatabaseConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Running Brain</h1>
        <p className="text-sm text-muted-foreground">
          Configura Supabase y sincroniza actividades para activar el Running Brain.
        </p>
      </div>
    );
  }

  const { prisma } = await import("@/lib/db/prisma");
  const brain = await prisma.runningBrain.findUnique({ where: { userId: session.userId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Running Brain</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas calculadas automáticamente desde tu historial
        </p>
      </div>
      <BrainStats brain={brain} />
      <ThresholdOverride currentThresholdSec={brain?.paceThresholdSec ?? null} />
      {brain?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Actualizado: {new Date(brain.updatedAt).toLocaleString("es-ES")}
        </p>
      )}
    </div>
  );
}
