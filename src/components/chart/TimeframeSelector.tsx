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

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

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
        <DropdownMenuTrigger className="flex h-9 min-w-[64px] items-center justify-between gap-1.5 rounded bg-tv-bg px-2.5 text-sm font-medium uppercase text-tv-text hover:bg-tv-panel-hover">
          <span>{tf}</span>
          <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[120px] bg-tv-panel">
          {TIMEFRAMES.map((t) => (
            <DropdownMenuItem
              key={t}
              onClick={() => setTf(t)}
              className={cn(
                "min-h-[44px] justify-center text-sm font-medium uppercase",
                tf === t && "bg-tv-panel-hover text-tv-text",
              )}
            >
              {t}
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
            "rounded px-2 py-1 text-xs font-medium uppercase transition-colors",
            tf === t
              ? "bg-tv-panel-hover text-tv-text"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
