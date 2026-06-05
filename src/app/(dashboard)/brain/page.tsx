import { auth } from "@/../auth";
import { prisma } from "@/lib/db/prisma";
import { BrainStats } from "@/components/dashboard/BrainStats";
import { Button } from "@/components/ui/button";
import { recalculateBrain } from "@/lib/brain/calculator";
import { redirect } from "next/navigation";

async function recalculate(userId: string) {
  "use server";
  await recalculateBrain(userId);
  redirect("/brain");
}

export default async function BrainPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const brain = await prisma.runningBrain.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Running Brain</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas calculadas automáticamente desde tu historial
          </p>
        </div>
        <form action={recalculate.bind(null, session.user.id)}>
          <Button type="submit" variant="outline" size="sm">
            Recalcular
          </Button>
        </form>
      </div>

      <BrainStats brain={brain} />

      {brain?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Última actualización:{" "}
          {new Date(brain.updatedAt).toLocaleString("es-ES")}
        </p>
      )}
    </div>
  );
}
