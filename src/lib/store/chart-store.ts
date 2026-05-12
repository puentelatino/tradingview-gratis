"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "macd"
  | "volume"
  | "vrvp"
  | "squeezeMomentum";

export interface SqueezeMomentumConfig {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  useTrueRange: boolean;
  histUp1: string;
  histUp2: string;
  histDown1: string;
  histDown2: string;
  sqzNone: string;
  sqzOn: string;
  sqzOff: string;
}

export const DEFAULT_SQUEEZE_MOMENTUM_CONFIG: SqueezeMomentumConfig = {
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMult: 1.5,
  useTrueRange: true,
  histUp1: "#00FF00",
  histUp2: "#008000",
  histDown1: "#FF0000",
  histDown2: "#800000",
  sqzNone: "#2196F3",
  sqzOn: "#000000",
  sqzOff: "#808080",
};

export type VrvpPlacement = "left" | "right";

export interface VrvpConfig {
  /** Número de filas en que dividir el rango de precio visible */
  rowSize: number;
  /** Porcentaje del volumen total que define el Value Area (0-100) */
  valueAreaPercent: number;
  /** Ancho del recuadro como % del ancho del chart */
  widthPercent: number;
  /** Lado donde se renderiza el perfil */
  placement: VrvpPlacement;
  showPOC: boolean;
  showVAH: boolean;
  showVAL: boolean;
  upColor: string;
  downColor: string;
  pocColor: string;
}

export const DEFAULT_VRVP_CONFIG: VrvpConfig = {
  rowSize: 1000,
  valueAreaPercent: 70,
  widthPercent: 15,
  placement: "right",
  showPOC: true,
  showVAH: false,
  showVAL: false,
  upColor: "#26A69A",
  downColor: "#EF5350",
  pocColor: "#FFFFFF",
};

export type DrawingTool = "cursor" | "hline" | "measure" | "eraser";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
  vrvp: "#26a69a",
  squeezeMomentum: "#2196f3",
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
];

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  vrvpConfig: VrvpConfig;
  squeezeMomentumConfig: SqueezeMomentumConfig;
  watchlist: string[];

  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  setVrvpConfig: (patch: Partial<VrvpConfig>) => void;
  resetVrvpConfig: () => void;
  setSqueezeMomentumConfig: (patch: Partial<SqueezeMomentumConfig>) => void;
  resetSqueezeMomentumConfig: () => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "BTCUSDT",
      timeframe: "15m" as Timeframe,
      indicators: {
        ema20: true,
        ema50: true,
        ema200: false,
        rsi: true,
        macd: false,
        volume: true,
        vrvp: false,
        squeezeMomentum: false,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        rsi: false,
        macd: false,
        volume: false,
        vrvp: false,
        squeezeMomentum: false,
      },
      config: { ...DEFAULT_CONFIG },
      vrvpConfig: { ...DEFAULT_VRVP_CONFIG },
      squeezeMomentumConfig: { ...DEFAULT_SQUEEZE_MOMENTUM_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      tool: "cursor",
      priceLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          // When re-adding, ensure not hidden
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      setVrvpConfig: (patch) =>
        set((s) => ({ vrvpConfig: { ...s.vrvpConfig, ...patch } })),
      resetVrvpConfig: () => set({ vrvpConfig: { ...DEFAULT_VRVP_CONFIG } }),
      setSqueezeMomentumConfig: (patch) =>
        set((s) => ({ squeezeMomentumConfig: { ...s.squeezeMomentumConfig, ...patch } })),
      resetSqueezeMomentumConfig: () =>
        set({ squeezeMomentumConfig: { ...DEFAULT_SQUEEZE_MOMENTUM_CONFIG } }),
      addToWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.includes(s)
            ? state.watchlist
            : [...state.watchlist, s],
        })),
      removeFromWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.filter((x) => x !== s),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              symbol,
              price,
            },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
    }),
    {
      name: "tv-gratis-chart-state",
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        vrvpConfig: s.vrvpConfig,
        squeezeMomentumConfig: s.squeezeMomentumConfig,
        watchlist: s.watchlist,
      }),
    },
  ),
);
