"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "pwa-banner-dismissed";

type BannerType = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as Navigator & { standalone?: boolean }).standalone;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setBannerType("android");
    };

    if (isIOS) {
      setBannerType("ios");
    } else {
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setBannerType(null);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setBannerType(null);
    }
    setDeferredPrompt(null);
    sessionStorage.setItem(STORAGE_KEY, "1");
  }

  if (!bannerType) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-900/40">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <span className="text-xl shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          {bannerType === "android" ? (
            <>
              <p className="text-sm font-semibold leading-tight">Instalar como app</p>
              <p className="text-xs text-orange-100 mt-0.5">
                Accede más rápido desde tu pantalla de inicio
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-tight">Instalar en iPhone</p>
              <p className="text-xs text-orange-100 mt-0.5">
                Toca el botón Compartir → &quot;Añadir a pantalla de inicio&quot;
              </p>
            </>
          )}
        </div>
        {bannerType === "android" && (
          <button
            onClick={install}
            className="shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
