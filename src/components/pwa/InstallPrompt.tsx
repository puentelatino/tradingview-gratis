"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * Banner discreto de instalacion PWA.
 *  - Chrome/Edge/Android: escucha beforeinstallprompt y muestra un boton
 *    "Instalar app" que dispara prompt.prompt().
 *  - iOS Safari: no expone beforeinstallprompt. Si detectamos iOS sin estar
 *    ya en standalone, mostramos una instruccion "Compartir > Anadir a inicio".
 *  - Si ya esta instalada (display-mode: standalone) no renderiza nada.
 *  - Si el usuario lo cierra, no insistir en la misma sesion (sessionStorage).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Ya instalada → no mostrar
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS legacy
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (isStandalone) return;

    // Dismiss en sesion previa
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari (no soporta beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    if (isIOS) setIosHint(true);

    // Si el navegador dispara appinstalled, ocultar
    const installed = () => {
      setDeferred(null);
      setIosHint(false);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (dismissed) return null;
  if (!deferred && !iosHint) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "dismissed") dismiss();
    setDeferred(null);
  }

  return (
    <div className="pointer-events-auto fixed bottom-3 left-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-lg border border-tv-border bg-tv-panel/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-tv-blue/15 text-tv-blue">
          {deferred ? <Download className="h-4 w-4" /> : <Share className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-tv-text">Instalar TV Gratis</p>
          {deferred ? (
            <p className="mt-0.5 text-[11px] text-tv-text-muted">
              Tenlo siempre a mano como app, pantalla completa y arranque rápido.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-tv-text-muted">
              En iOS: pulsa <span className="font-medium text-tv-text">Compartir</span> y
              luego <span className="font-medium text-tv-text">Añadir a pantalla de inicio</span>.
            </p>
          )}
          {deferred && (
            <button
              type="button"
              onClick={install}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded bg-tv-blue px-3 text-xs font-semibold text-white hover:bg-tv-blue/90"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
