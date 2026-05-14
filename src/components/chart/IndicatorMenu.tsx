"use client";

import { useState } from "react";
import { Activity, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChartStore, type IndicatorKey } from "@/lib/store/chart-store";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface Entry {
  key: IndicatorKey;
  label: (cfg: {
    ema20: number;
    ema50: number;
    ema200: number;
    rsi: number;
    macdFast: number;
    macdSlow: number;
    macdSignal: number;
  }) => string;
  group: string;
}

const ENTRIES: Entry[] = [
  { key: "ema20", group: "Medias móviles", label: (c) => `EMA ${c.ema20}` },
  { key: "ema50", group: "Medias móviles", label: (c) => `EMA ${c.ema50}` },
  { key: "ema200", group: "Medias móviles", label: (c) => `EMA ${c.ema200}` },
  { key: "volume", group: "Volumen", label: () => "Volumen" },
  { key: "vrvp", group: "Volumen", label: () => "Volume Profile (VRVP)" },
  { key: "koncorde", group: "Volumen", label: () => "Koncorde (Blai5)" },
  { key: "rsi", group: "Osciladores", label: (c) => `RSI (${c.rsi})` },
  {
    key: "macd",
    group: "Osciladores",
    label: (c) => `MACD (${c.macdFast}, ${c.macdSlow}, ${c.macdSignal})`,
  },
  {
    key: "squeezeMomentum",
    group: "Momento",
    label: () => "Squeeze Momentum (LazyBear)",
  },
];

export function IndicatorMenu() {
  const indicators = useChartStore((s) => s.indicators);
  const config = useChartStore((s) => s.config);
  const toggle = useChartStore((s) => s.toggleIndicator);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const groups = ENTRIES.reduce<Record<string, Entry[]>>((acc, i) => {
    (acc[i.group] ||= []).push(i);
    return acc;
  }, {});

  const activeCount = Object.values(indicators).filter(Boolean).length;

  const triggerClass =
    "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover";

  const TriggerInner = (
    <>
      <Activity className="h-3.5 w-3.5" />
      <span>Indicadores</span>
      {activeCount > 0 && (
        <span className="ml-1 rounded bg-tv-blue/20 px-1.5 py-0.5 text-[10px] font-semibold text-tv-blue">
          {activeCount}
        </span>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(triggerClass, "min-h-[44px] w-full justify-start")}
        >
          {TriggerInner}
        </button>
        <SheetContent side="bottom" className="max-h-[85vh] bg-tv-panel">
          <SheetHeader>
            <SheetTitle>Indicadores</SheetTitle>
          </SheetHeader>
          <SheetBody className="px-2 pb-4 pt-2">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
                  {group}
                </p>
                {items.map((i) => (
                  <button
                    key={i.key}
                    onClick={() => toggle(i.key)}
                    className="flex min-h-[44px] w-full items-center justify-between rounded px-3 py-2 text-sm text-tv-text hover:bg-tv-panel-hover"
                  >
                    <span>{i.label(config)}</span>
                    {indicators[i.key] && (
                      <Check className="h-4 w-4 text-tv-blue" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </SheetBody>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClass}>
        {TriggerInner}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-tv-panel">
        {Object.entries(groups).map(([group, items], idx) => (
          <DropdownMenuGroup key={group}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
              {group}
            </DropdownMenuLabel>
            {items.map((i) => (
              <DropdownMenuItem
                key={i.key}
                closeOnClick={false}
                onClick={() => toggle(i.key)}
                className="flex items-center justify-between text-xs"
              >
                <span>{i.label(config)}</span>
                {indicators[i.key] && <Check className="h-3.5 w-3.5 text-tv-blue" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
