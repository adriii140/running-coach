"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";
import Image from "next/image";

interface AppShellProps {
  user: { name?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:flex h-screen overflow-hidden bg-background">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-6xl py-6 px-6">{children}</div>
        </main>
      </div>

      {/* Mobile layout — sin overflow-hidden para que los toques funcionen */}
      <div className="lg:hidden min-h-screen bg-background">
        {/* Overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-[999] bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar drawer — z-[1000] supera los z-index de Leaflet (máx ~800) */}
        <div
          className={`fixed inset-y-0 left-0 z-[1000] transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background sticky top-0 z-[900]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image src="/icons/icon.png" alt="RunCoach" width={28} height={28} className="rounded-lg" unoptimized />
            <span className="text-sm font-bold">RunCoach</span>
          </div>
        </header>

        {/* Content */}
        <div className="px-4 py-5">{children}</div>
      </div>
    </>
  );
}
