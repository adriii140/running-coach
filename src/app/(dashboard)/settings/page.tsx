import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

function EnvStatus({ value, label }: { value: string | undefined; label: string }) {
  const configured = !!value && !value.includes("placeholder") && value.length > 0;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground font-mono text-xs">{label}</span>
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
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estado de las integraciones
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <span className="text-sm font-medium">{session.name}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Strava</span>
            <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1">
              <CheckCircle className="h-3 w-3" /> Conectado
            </Badge>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-muted-foreground">Sesión</span>
            <span className="text-sm text-muted-foreground">Válida 30 días desde el último login</span>
          </div>
        </CardContent>
      </Card>

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
        </CardContent>
      </Card>
    </div>
  );
}
