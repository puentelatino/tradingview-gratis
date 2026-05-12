"use client";

import { useState } from "react";
import { Code2, Zap, Menu, Search, ChevronDown, List } from "lucide-react";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from "@/components/ui/sheet";
import { LeftSidebar } from "./LeftSidebar";
import { Watchlist } from "@/components/watchlist/Watchlist";
import { useChartStore } from "@/lib/store/chart-store";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const symbol = useChartStore((s) => s.symbol);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);

  return (
    <header className="flex h-12 items-center justify-between border-b border-tv-border bg-tv-panel px-2 md:px-3">
      {/* ── Desktop layout ─────────────────────────────────────────── */}
      <div className="hidden items-center gap-1 md:flex">
        <div className="flex items-center gap-2 pr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-tv-blue/20">
            <Zap className="h-4 w-4 text-tv-blue" />
          </div>
          <span className="text-sm font-semibold text-tv-text">
            TradingView <span className="text-tv-text-muted">Gratis</span>
          </span>
        </div>
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <SymbolSelector />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <TimeframeSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <IndicatorMenu />
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>Source</span>
        </a>
      </div>

      {/* ── Mobile layout ──────────────────────────────────────────── */}
      <div className="flex w-full items-center justify-between gap-2 md:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SheetContent side="left" className="bg-tv-panel">
            <SheetHeader>
              <SheetTitle>Herramientas</SheetTitle>
            </SheetHeader>
            <SheetBody className="flex flex-col">
              <div className="border-b border-tv-border p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
                  Dibujo
                </p>
                <MobileToolbar onPick={() => setMenuOpen(false)} />
              </div>
              <div className="p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
                  Indicadores
                </p>
                <IndicatorMenu />
              </div>
            </SheetBody>
          </SheetContent>
        </Sheet>

        {/* Pill central — símbolo */}
        <button
          type="button"
          onClick={() => openSymbolDialog(true)}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded bg-tv-bg px-3 text-sm font-semibold text-tv-text hover:bg-tv-panel-hover"
        >
          <Search className="h-4 w-4 shrink-0 text-tv-text-muted" />
          <span className="truncate tabular-nums">{symbol}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-tv-text-muted" />
        </button>

        <TimeframeSelector compact />

        <Sheet open={watchlistOpen} onOpenChange={setWatchlistOpen}>
          <button
            type="button"
            onClick={() => setWatchlistOpen(true)}
            aria-label="Abrir watchlist"
            className="flex h-10 w-10 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          >
            <List className="h-5 w-5" />
          </button>
          <SheetContent side="right" className="bg-tv-panel">
            <SheetHeader>
              <SheetTitle>Watchlist</SheetTitle>
            </SheetHeader>
            <SheetBody>
              <Watchlist />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

/**
 * Toolbar de herramientas de dibujo en formato lista vertical para el sheet
 * móvil. Reutiliza la misma lógica del store que LeftSidebar.
 */
function MobileToolbar({ onPick }: { onPick: () => void }) {
  return (
    <div className="-mx-3">
      <LeftSidebar variant="mobile" onPick={onPick} />
    </div>
  );
}
