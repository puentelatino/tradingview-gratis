"use client";

import { useEffect, useState } from "react";

/**
 * Hook SSR-safe para media queries. Devuelve siempre `false` en el render
 * inicial (cliente + servidor) para evitar hydration mismatches en Next.js,
 * y se sincroniza con `matchMedia` tras montar en el cliente.
 *
 * Uso preferente: layout decisions van por Tailwind (md:, lg:). Este hook
 * sólo para ramas de render condicionales en JS (p. ej. Dropdown vs Sheet).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Móvil = viewport < md (768px) de Tailwind */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
