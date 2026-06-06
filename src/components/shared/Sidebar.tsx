"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Brain,
  Target,
  Calendar,
  Settings,
  LogOut,
  Dumbbell,
  Bot,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activities", label: "Actividades", icon: Activity },
  { href: "/brain", label: "Running Brain", icon: Brain },
  { href: "/coach", label: "Coach AI", icon: Bot },
  { href: "/progress", label: "Progreso", icon: TrendingUp },
  { href: "/goals", label: "Objetivos", icon: Target },
  { href: "/events", label: "Carreras", icon: Calendar },
  { href: "/strength", label: "Fuerza", icon: Dumbbell },
  { href: "/settings", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  user: { name?: string | null; image?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border/50 bg-card">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border/50">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <Activity className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Running</p>
          <p className="text-xs text-muted-foreground">Copilot AI</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/50 p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
            <AvatarFallback>
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name ?? "Usuario"}</p>
          </div>
          <a
            href="/api/auth/logout"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}
