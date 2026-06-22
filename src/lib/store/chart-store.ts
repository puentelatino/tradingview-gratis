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
  | "squeezeMomentum"
  | "koncorde"
  | "dmiAdx";

export interface DmiAdxConfig {
  adxLength: number;
  diLength: number;
  keyLevel: number;
  adxColor: string;
  plusDIColor: string;
  minusDIColor: string;
  keyLevelColor: string;
  keyLevelDashed: boolean;
}

export const DEFAULT_DMI_ADX_CONFIG: DmiAdxConfig = {
  adxLength: 14,
  diLength: 14,
  keyLevel: 23,
  adxColor: "#FF0000",
  plusDIColor: "#2196F3",
  minusDIColor: "#9E9E9E",
  keyLevelColor: "#FFFFFF",
  keyLevelDashed: true,
};

export interface KoncordeConfig {
  m: number;
  bollLength: number;
  bollMult: number;
  mfiLength: number;
  rsiLength: number;
  stochLength: number;
  stochSmooth: number;
  rangeLookback: number;
  /** Colores: areas (verde/marron/azul) + lineas contorno + linea media */
  areaVerde: string;
  areaMarron: string;
  areaAzul: string;
  lineaVerde: string;
  lineaMarron: string;
  lineaAzul: string;
  lineaMedia: string;
}

export const DEFAULT_KONCORDE_CONFIG: KoncordeConfig = {
  m: 15,
  bollLength: 25,
  bollMult: 2.0,
  mfiLength: 14,
  rsiLength: 14,
  stochLength: 21,
  stochSmooth: 3,
  rangeLookback: 90,
  areaVerde: "#66FF66",
  areaMarron: "#FFCC99",
  areaAzul: "#00FFFF",
  lineaVerde: "#006600",
  lineaMarron: "#800000",
  lineaAzul: "#000066",
  lineaMedia: "#FF0000",
};

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
  widthPercent: 10,
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
  koncorde: "#66ff66",
  dmiAdx: "#ff0000",
};

/**
 * Colores editables por el usuario de los indicadores antiguos (EMA, RSI,
 * MACD, Volume). Persistido en localStorage. Los indicadores nuevos
 * (VRVP/Squeeze/Koncorde) tienen sus propios objetos de config con colores.
 *
 * Para resetear, se usan los valores de DEFAULT_INDICATOR_COLORS.
 */
export interface IndicatorColors {
  ema20: string;
  ema50: string;
  ema200: string;
  rsi: string;
  /** Linea MACD */
  macdLine: string;
  /** Linea Signal del MACD */
  macdSignal: string;
  /** Histograma MACD para barras positivas */
  macdHistUp: string;
  /** Histograma MACD para barras negativas */
  macdHistDown: string;
  /** Barras de volumen alcistas */
  volumeUp: string;
  /** Barras de volumen bajistas */
  volumeDown: string;
}

export const DEFAULT_INDICATOR_COLORS: IndicatorColors = {
  ema20: INDICATOR_COLORS.ema20,
  ema50: INDICATOR_COLORS.ema50,
  ema200: INDICATOR_COLORS.ema200,
  rsi: INDICATOR_COLORS.rsi,
  macdLine: "#2962ff",
  macdSignal: "#ffb74d",
  macdHistUp: "#26a69a",
  macdHistDown: "#ef5350",
  volumeUp: "#26a69a",
  volumeDown: "#ef5350",
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
  /** Colores editables de EMA/RSI/MACD/Volume */
  indicatorColors: IndicatorColors;
  vrvpConfig: VrvpConfig;
  squeezeMomentumConfig: SqueezeMomentumConfig;
  koncordeConfig: KoncordeConfig;
  dmiAdxConfig: DmiAdxConfig;
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
  setIndicatorColor: <K extends keyof IndicatorColors>(
    key: K,
    color: IndicatorColors[K],
  ) => void;
  resetIndicatorColors: () => void;
  setVrvpConfig: (patch: Partial<VrvpConfig>) => void;
  resetVrvpConfig: () => void;
  setSqueezeMomentumConfig: (patch: Partial<SqueezeMomentumConfig>) => void;
  resetSqueezeMomentumConfig: () => void;
  setKoncordeConfig: (patch: Partial<KoncordeConfig>) => void;
  resetKoncordeConfig: () => void;
  setDmiAdxConfig: (patch: Partial<DmiAdxConfig>) => void;
  resetDmiAdxConfig: () => void;
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
        koncorde: false,
        dmiAdx: false,
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
        koncorde: false,
        dmiAdx: false,
      },
      config: { ...DEFAULT_CONFIG },
      indicatorColors: { ...DEFAULT_INDICATOR_COLORS },
      vrvpConfig: { ...DEFAULT_VRVP_CONFIG },
      squeezeMomentumConfig: { ...DEFAULT_SQUEEZE_MOMENTUM_CONFIG },
      koncordeConfig: { ...DEFAULT_KONCORDE_CONFIG },
      dmiAdxConfig: { ...DEFAULT_DMI_ADX_CONFIG },
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
      setIndicatorColor: (key, color) =>
        set((s) => ({
          indicatorColors: { ...s.indicatorColors, [key]: color },
        })),
      resetIndicatorColors: () =>
        set({ indicatorColors: { ...DEFAULT_INDICATOR_COLORS } }),
      setVrvpConfig: (patch) =>
        set((s) => ({ vrvpConfig: { ...s.vrvpConfig, ...patch } })),
      resetVrvpConfig: () => set({ vrvpConfig: { ...DEFAULT_VRVP_CONFIG } }),
      setSqueezeMomentumConfig: (patch) =>
        set((s) => ({ squeezeMomentumConfig: { ...s.squeezeMomentumConfig, ...patch } })),
      resetSqueezeMomentumConfig: () =>
        set({ squeezeMomentumConfig: { ...DEFAULT_SQUEEZE_MOMENTUM_CONFIG } }),
      setKoncordeConfig: (patch) =>
        set((s) => ({ koncordeConfig: { ...s.koncordeConfig, ...patch } })),
      resetKoncordeConfig: () => set({ koncordeConfig: { ...DEFAULT_KONCORDE_CONFIG } }),
      setDmiAdxConfig: (patch) =>
        set((s) => ({ dmiAdxConfig: { ...s.dmiAdxConfig, ...patch } })),
      resetDmiAdxConfig: () => set({ dmiAdxConfig: { ...DEFAULT_DMI_ADX_CONFIG } }),
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
      version: 1,
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        indicatorColors: s.indicatorColors,
        vrvpConfig: s.vrvpConfig,
        squeezeMomentumConfig: s.squeezeMomentumConfig,
        koncordeConfig: s.koncordeConfig,
        dmiAdxConfig: s.dmiAdxConfig,
        watchlist: s.watchlist,
      }),
      // Deep merge: blinda contra evoluciones del schema. Cuando se anaden
      // nuevas claves al estado (p. ej. un nuevo subcampo en vrvpConfig),
      // los usuarios con localStorage previo conservan lo suyo y reciben
      // los defaults para los campos nuevos en lugar de quedar undefined.
      merge: (persisted, current) =>
        deepMerge(current, persisted as Partial<ChartState>) as ChartState,
    },
  ),
);

/**
 * Deep merge inmutable: campos del segundo argumento sobreescriben a los del
 * primero. Objetos planos (no arrays, no Date, no Map, no Set, no funciones)
 * se fusionan recursivamente; cualquier otro tipo (arrays incluidos) se
 * reemplaza tal cual viene del persisted.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : (patch as T);
  }
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(patch)) {
    const b = (base as Record<string, unknown>)[key];
    const p = patch[key];
    if (isPlainObject(b) && isPlainObject(p)) {
      out[key] = deepMerge(b, p);
    } else if (p !== undefined) {
      out[key] = p;
    }
  }
  return out as T;
}
