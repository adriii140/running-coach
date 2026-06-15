"use client";

import { useState } from "react";
import Image from "next/image";
import { User, MapPin, Settings, Zap, LogOut, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SettingsClientProps {
  user: {
    name: string;
    email: string | null;
    image: string | null;
    stravaConnected: boolean;
  };
  settings: {
    unitSystem: string;
    timezone: string;
    weekStartsOn: number;
    homeLocationName: string | null;
    homeLocationLat: number | null;
    homeLocationLng: number | null;
    autoSync: boolean;
  };
  envStatus: {
    groq: boolean;
    gemini: boolean;
    openrouter: boolean;
    ors: boolean;
  };
}

const TIMEZONES = [
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-base">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function SettingsClient({ user, settings, envStatus }: SettingsClientProps) {
  const [form, setForm] = useState({
    unitSystem: settings.unitSystem,
    timezone: settings.timezone,
    weekStartsOn: settings.weekStartsOn,
    homeLocationName: settings.homeLocationName ?? "",
    homeLocationLat: settings.homeLocationLat ?? "",
    homeLocationLng: settings.homeLocationLng ?? "",
    autoSync: settings.autoSync,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        ...form,
        homeLocationLat: form.homeLocationLat === "" ? null : Number(form.homeLocationLat),
        homeLocationLng: form.homeLocationLng === "" ? null : Number(form.homeLocationLng),
        weekStartsOn: Number(form.weekStartsOn),
      };
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          homeLocationLat: pos.coords.latitude,
          homeLocationLng: pos.coords.longitude,
        }));
        setGeoLoading(false);
      },
      () => setGeoLoading(false)
    );
  }

  const envItems: { key: keyof typeof envStatus; label: string }[] = [
    { key: "groq", label: "GROQ_API_KEY" },
    { key: "gemini", label: "GEMINI_API_KEY" },
    { key: "openrouter", label: "OPENROUTER_API_KEY" },
    { key: "ors", label: "OPENROUTESERVICE_API_KEY" },
  ];

  return (
    <div className="space-y-6 max-w-2xl pb-10">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona tu cuenta y preferencias</p>
      </div>

      {/* Success banner */}
      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-500 text-sm px-4 py-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Guardado correctamente
        </div>
      )}

      {/* 1. Cuenta */}
      <SectionCard icon={<User className="h-4 w-4" />} title="Cuenta">
        <div className="space-y-3">
          <Row label="Foto">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name}
                width={36}
                height={36}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </Row>
          <Row label="Nombre">
            <span className="text-sm font-medium">{user.name}</span>
          </Row>
          {user.email && (
            <Row label="Email">
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </Row>
          )}
          <Row label="Strava">
            {user.stravaConnected ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1 text-xs">
                <CheckCircle className="h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 text-xs">
                  <XCircle className="h-3 w-3" /> No conectado
                </Badge>
                <a
                  href="/api/auth/strava"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Conectar
                </a>
              </div>
            )}
          </Row>
        </div>
      </SectionCard>

      {/* 2. Ubicación de casa */}
      <SectionCard icon={<MapPin className="h-4 w-4" />} title="Ubicación de casa">
        <p className="text-xs text-muted-foreground -mt-2">
          Punto de partida por defecto para la generación de rutas
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nombre del lugar</label>
            <input
              type="text"
              value={form.homeLocationName}
              onChange={(e) => set("homeLocationName", e.target.value)}
              placeholder="Ej: Madrid, España"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Latitud</label>
              <input
                type="number"
                step="any"
                value={form.homeLocationLat}
                onChange={(e) => set("homeLocationLat", e.target.value as unknown as number)}
                placeholder="40.4168"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Longitud</label>
              <input
                type="number"
                step="any"
                value={form.homeLocationLng}
                onChange={(e) => set("homeLocationLng", e.target.value as unknown as number)}
                placeholder="-3.7038"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={useMyLocation}
            disabled={geoLoading}
            className="text-xs"
          >
            <MapPin className="h-3 w-3 mr-1" />
            {geoLoading ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
          </Button>
        </div>
      </SectionCard>

      {/* 3. Preferencias */}
      <SectionCard icon={<Settings className="h-4 w-4" />} title="Preferencias">
        <div className="space-y-4">
          {/* Unit system toggle */}
          <Row label="Sistema de unidades">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => set("unitSystem", "metric")}
                className={`px-3 py-1.5 transition-colors ${
                  form.unitSystem === "metric"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Métrico (km)
              </button>
              <button
                onClick={() => set("unitSystem", "imperial")}
                className={`px-3 py-1.5 transition-colors ${
                  form.unitSystem === "imperial"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Imperial (mi)
              </button>
            </div>
          </Row>

          {/* Week starts on */}
          <Row label="La semana empieza el">
            <select
              value={form.weekStartsOn}
              onChange={(e) => set("weekStartsOn", Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={1}>Lunes</option>
              <option value={0}>Domingo</option>
            </select>
          </Row>

          {/* Timezone */}
          <Row label="Zona horaria">
            <select
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Row>

          {/* Auto-sync */}
          <Row label="Sincronización automática con Strava">
            <button
              role="switch"
              aria-checked={form.autoSync}
              onClick={() => set("autoSync", !form.autoSync)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                form.autoSync ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                  form.autoSync ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </Row>
        </div>
      </SectionCard>

      {/* 4. Integraciones */}
      <SectionCard icon={<Zap className="h-4 w-4" />} title="Integraciones">
        <p className="text-xs text-muted-foreground -mt-2">
          Estado de las variables de entorno configuradas en el servidor
        </p>
        <div className="divide-y divide-border/50">
          {envItems.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-2.5">
              <span className="font-mono text-xs text-muted-foreground">{label}</span>
              {envStatus[key] ? (
                <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1 text-xs">
                  <CheckCircle className="h-3 w-3" /> Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                  <XCircle className="h-3 w-3" /> No configurado
                </Badge>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </Button>

      {/* 5. Zona de peligro */}
      <SectionCard icon={<LogOut className="h-4 w-4" />} title="Sesión">
        <a href="/api/auth/logout">
          <Button variant="destructive" size="sm" className="gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </a>
      </SectionCard>
    </div>
  );
}
