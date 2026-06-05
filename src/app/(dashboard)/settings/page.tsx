import { auth } from "@/../auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

function EnvStatus({ value, label }: { value: string | undefined; label: string }) {
  const configured = !!value && value.length > 0;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {configured ? (
        <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1">
          <CheckCircle className="h-3 w-3" /> Configurado
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <XCircle className="h-3 w-3" /> No configurado
        </Badge>
      )}
    </div>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stravaId: true,
      stravaTokenExpiry: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { activities: true } },
    },
  });

  const stravaConnected = !!user?.stravaId;
  const tokenExpiry = user?.stravaTokenExpiry;
  const tokenValid = tokenExpiry ? tokenExpiry > new Date() : false;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estado de las integraciones y variables de entorno
        </p>
      </div>

      {/* Cuenta */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <span className="text-sm font-medium">{user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Strava ID</span>
            <span className="text-sm font-mono">{user?.stravaId ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Token Strava</span>
            <Badge
              variant="outline"
              className={tokenValid ? "text-green-500" : "text-red-500"}
            >
              {tokenValid ? "Válido" : "Expirado"}
            </Badge>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Actividades importadas</span>
            <span className="text-sm font-medium">{user?._count.activities ?? 0}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Miembro desde</span>
            <span className="text-sm text-muted-foreground">
              {user?.createdAt.toLocaleDateString("es-ES") ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Variables de entorno */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variables de entorno</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <EnvStatus value={process.env.STRAVA_CLIENT_ID} label="STRAVA_CLIENT_ID" />
          <EnvStatus value={process.env.STRAVA_CLIENT_SECRET} label="STRAVA_CLIENT_SECRET" />
          <EnvStatus value={process.env.DATABASE_URL} label="DATABASE_URL" />
          <EnvStatus value={process.env.AUTH_SECRET} label="AUTH_SECRET" />
          <EnvStatus value={process.env.OPENROUTESERVICE_API_KEY} label="OPENROUTESERVICE_API_KEY" />
          <EnvStatus value={process.env.OPENROUTER_API_KEY} label="OPENROUTER_API_KEY" />
          <EnvStatus value={process.env.GROQ_API_KEY} label="GROQ_API_KEY" />
          <EnvStatus value={process.env.OLLAMA_URL} label="OLLAMA_URL" />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Las variables de entorno se configuran en el archivo{" "}
        <code className="rounded bg-muted px-1 py-0.5">.env.local</code> en la
        raíz del proyecto.
      </p>
    </div>
  );
}
