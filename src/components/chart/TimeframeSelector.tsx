"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartStore } from "@/lib/store/chart-store";
import type { Timeframe } from "@/lib/binance/types";
import { cn } from "@/lib/utils";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];

/**
 * Label visible. Diferenciamos minutos (minusculas) de horas/dias/semana/mes
 * (mayusculas) y renombramos "1M" → "1Mo" para que no se confunda con minuto.
 * El valor interno enviado a Binance es siempre el de Timeframe (1m, 1M, ...).
 */
const LABELS: Record<Timeframe, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "2h": "2H",
  "4h": "4H",
  "6h": "6H",
  "8h": "8H",
  "12h": "12H",
  "1d": "1D",
  "3d": "3D",
  "1w": "1W",
  "1M": "1Mo",
};

interface Props {
  /** Si true, renderiza como dropdown compacto (móvil). Default: false (fila). */
  compact?: boolean;
}

export function TimeframeSelector({ compact = false }: Props) {
  const tf = useChartStore((s) => s.timeframe);
  const setTf = useChartStore((s) => s.setTimeframe);

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-9 min-w-[64px] items-center justify-between gap-1.5 rounded bg-tv-bg px-2.5 text-sm font-medium text-tv-text hover:bg-tv-panel-hover">
          <span>{LABELS[tf]}</span>
          <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[120px] bg-tv-panel">
          {TIMEFRAMES.map((t) => (
            <DropdownMenuItem
              key={t}
              onClick={() => setTf(t)}
              className={cn(
                "min-h-[44px] justify-center text-sm font-medium",
                tf === t && "bg-tv-panel-hover text-tv-text",
              )}
            >
              {LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded bg-tv-bg p-0.5">
      {TIMEFRAMES.map((t) => (
        <button
          key={t}
          onClick={() => setTf(t)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors",
            tf === t
              ? "bg-tv-panel-hover text-tv-text"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
        >
          {LABELS[t]}
        </button>
      ))}
    </div>
  );
}
