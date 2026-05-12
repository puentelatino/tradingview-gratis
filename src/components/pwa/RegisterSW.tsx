"use client";

import { useEffect } from "react";

/**
 * Registra el service worker en /sw.js, pero solo en produccion.
 * En desarrollo el SW interfiere con el hot reload de Next/Turbopack y puede
 * servir versiones cacheadas que confunden al depurar.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("[SW] registro fallido:", err);
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
