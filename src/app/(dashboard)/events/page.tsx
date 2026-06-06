import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Calendar } from "lucide-react";

export default async function EventsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Carreras</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona tus eventos deportivos y carreras
        </p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Calendar className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Próximamente — Fase 2</p>
      </div>
    </div>
  );
}
