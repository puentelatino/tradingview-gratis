"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  /** Si true, sólo dígitos enteros; si false, decimales permitidos. Default: false */
  integer?: boolean;
  /** Step puramente decorativo (no se usa con type=text); informativo */
  step?: number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Input numérico SSR-safe y a prueba de tontos en móvil.
 *
 * - Mantiene un draft local string para que el usuario pueda dejar el campo
 *   vacío mientras edita (clave en móvil: borrar todos los dígitos para
 *   reescribir). El store SÓLO se actualiza al confirmar (blur / Enter), no
 *   en cada keystroke.
 * - Si el draft al confirmar está vacío o no es un número válido, se descarta
 *   y se restaura el value de la prop. Si está fuera de rango, se clampa.
 * - Usa type="text" + inputMode para que aparezca el teclado numérico en
 *   móvil sin la basura del spinner ni los comportamientos inconsistentes
 *   entre navegadores de type="number".
 * - El draft se resincroniza desde la prop cuando ésta cambia y el campo no
 *   está enfocado (p. ej. al abrir el dialog o tras un reset).
 */
export function NumericInput({
  value,
  onCommit,
  min,
  max,
  integer = false,
  step,
  placeholder,
  className,
  ariaLabel,
}: Props) {
  const [draft, setDraft] = useState<string>(() => String(value));
  const focusedRef = useRef(false);

  // Sincronizar draft con el value externo cuando NO está enfocado
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === ".") {
      // Vacío o intermedio: restaurar valor anterior
      setDraft(String(value));
      return;
    }
    const parsed = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (!isFinite(parsed) || isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    let next = parsed;
    if (typeof min === "number" && next < min) next = min;
    if (typeof max === "number" && next > max) next = max;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setDraft(String(value));
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  // Permitimos dígitos, signo, separador decimal (si no es integer) — filtrado
  // ligero para que el campo nunca contenga letras. No bloqueamos vacío.
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      setDraft("");
      return;
    }
    const re = integer ? /^-?\d*$/ : /^-?\d*([.,]\d*)?$/;
    if (!re.test(raw)) return; // ignora la pulsación
    // Normalizamos coma a punto para el parseFloat posterior
    setDraft(integer ? raw : raw.replace(",", "."));
  }

  return (
    <input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      pattern={integer ? "[0-9]*" : undefined}
      value={draft}
      onChange={onChange}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-step={step}
      className={cn(
        "rounded border border-tv-border bg-tv-bg px-2 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue tabular-nums",
        className,
      )}
    />
  );
}
