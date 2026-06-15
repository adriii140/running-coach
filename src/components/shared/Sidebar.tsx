"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Activity,
  Brain,
  Target,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  Dumbbell,
  Bot,
  TrendingUp,
  Map,
  X,
} from "lucide-react";
// Activity is still used in navItems below
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activities", label: "Actividades", icon: Activity },
  { href: "/brain", label: "Running Brain", icon: Brain },
  { href: "/coach", label: "Coach AI", icon: Bot },
  { href: "/progress", label: "Progreso", icon: TrendingUp },
  { href: "/routes", label: "Rutas", icon: Map },
  { href: "/goals", label: "Objetivos", icon: Target },
  { href: "/events", label: "Carreras", icon: Calendar },
  { href: "/training", label: "Plan de entreno", icon: ClipboardList },
  { href: "/strength", label: "Fuerza", icon: Dumbbell },
  { href: "/settings", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  user: { name?: string | null; image?: string | null };
  onClose?: () => void;
}

export function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col bg-background border-r border-border/40">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border/40">
        <div className="flex items-center gap-3">
          <Image src="/icons/icon.png" alt="RunCoach" width={36} height={36} className="rounded-xl" unoptimized />
          <div>
            <p className="text-sm font-bold leading-none">RunCoach</p>
            <p className="text-xs text-muted-foreground mt-0.5">AI Running Coach</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                    isActive
                      ? "bg-gradient-to-r from-orange-500/15 to-orange-500/5 text-orange-400 border-l-[3px] border-orange-500 pl-[9px] font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn("h-4 w-4 shrink-0", isActive && "text-orange-400")}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-border/40 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/40 transition-colors group">
          <Avatar className="h-8 w-8 border border-border/50">
            {user.image?.startsWith("http") && (
              <AvatarImage src={user.image} alt={user.name ?? ""} />
            )}
            <AvatarFallback className="bg-orange-500/10 text-orange-400 text-xs font-semibold">
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.name ?? "Usuario"}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <p className="text-[10px] text-muted-foreground">Strava conectado</p>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
