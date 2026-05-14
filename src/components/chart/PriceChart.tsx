"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Settings, X } from "lucide-react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  BaselineSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchKlines } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import {
  ema,
  rsi,
  macd,
  calculateSqueezeMomentum,
  calculateKoncorde,
} from "@/lib/indicators";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MeasureOverlay } from "./MeasureOverlay";
import { VolumeProfileOverlay } from "./VolumeProfileOverlay";
import { VolumeProfileSettingsDialog } from "./VolumeProfileSettingsDialog";
import { SqueezeMomentumSettingsDialog } from "./SqueezeMomentumSettingsDialog";
import { KoncordeSettingsDialog } from "./KoncordeSettingsDialog";

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

/**
 * Convierte un color #RRGGBB en `rgba(r,g,b,a)`. Solo soporta hex de 6
 * digitos — suficiente para nuestros defaults; entrada invalida → blanco.
 */
function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${a})`;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  volume?: number;
  squeezeVal?: number;
  squeezeState?: "on" | "off" | "none";
  koncordeAzul?: number;
  koncordeMarron?: number;
  koncordeVerde?: number;
  koncordeMedia?: number;
}

interface PaneOffset {
  top: number;
  height: number;
}

export function PriceChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzDotNoneRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sqzDotOnRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sqzDotOffRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Koncorde — 3 BaselineSeries (areas) + 4 LineSeries (contornos + media)
  const koncordeVerdeAreaRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const koncordeMarronAreaRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const koncordeAzulAreaRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const koncordeVerdeLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const koncordeMarronLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const koncordeAzulLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const koncordeMediaLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const vrvpConfig = useChartStore((s) => s.vrvpConfig);
  const sqzConfig = useChartStore((s) => s.squeezeMomentumConfig);
  const koncordeConfig = useChartStore((s) => s.koncordeConfig);
  const isMobile = useIsMobile();
  const [vrvpDialogOpen, setVrvpDialogOpen] = useState(false);
  const [sqzDialogOpen, setSqzDialogOpen] = useState(false);
  const [koncordeDialogOpen, setKoncordeDialogOpen] = useState(false);
  const sqzConfigRef = useRef(sqzConfig);
  sqzConfigRef.current = sqzConfig;
  const koncordeConfigRef = useRef(koncordeConfig);
  koncordeConfigRef.current = koncordeConfig;
  const tool = useChartStore((s) => s.tool);
  const priceLines = useChartStore((s) => s.priceLines);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);

  // Refs to avoid recreating subscribeClick on every tool change
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const configRef = useRef(config);
  configRef.current = config;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [renderTick, setRenderTick] = useState(0);
  const measureRef = useRef(measure);
  measureRef.current = measure;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    setPaneOffsets(offsets);
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: TV_COLORS.bg },
        textColor: TV_COLORS.text,
        fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.border },
      },
      grid: {
        vertLines: { color: TV_COLORS.grid },
        horzLines: { color: TV_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
        horzLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.textMuted,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
      },
      // En móvil queremos que el chart no capture el gesto vertical de la
      // página (pan vertical = scroll de la página, no zoom del eje de precio).
      // El drag horizontal y el pinch siguen funcionando.
      handleScroll: {
        vertTouchDrag: false,
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;

    // Click handler — add horizontal price line when hline tool is active
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price === null || !isFinite(price)) return;

      if (toolRef.current === "hline") {
        addPriceLineRef.current(price, symbolRef.current);
        return;
      }

      if (toolRef.current === "measure") {
        if (!param.time) return;
        const time = Number(param.time);
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        } else if (current.phase === "placing") {
          setMeasure({
            phase: "done",
            a: current.a,
            b: { time, price },
          });
        } else {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        }
      }
    });

    // Crosshair handler
    chart.subscribeCrosshairMove((param) => {
      if (
        toolRef.current === "measure" &&
        measureRef.current.phase === "placing" &&
        param.point &&
        param.time &&
        candleSeriesRef.current
      ) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price !== null && isFinite(price)) {
          const time = Number(param.time);
          setMeasure((prev) =>
            prev.phase === "placing" ? { ...prev, b: { time, price } } : prev,
          );
        }
      }

      if (!param.time || !candleSeriesRef.current) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current
        ? param.seriesData.get(volumeSeriesRef.current)
        : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        setHover({
          o,
          h: data.high as number,
          l: data.low as number,
          c,
          v: vol && "value" in vol ? (vol.value as number) : 0,
          time: Number(param.time),
          pct: o === 0 ? 0 : ((c - o) / o) * 100,
        });
      }
    });

    // Re-render measure overlay on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => recomputePaneOffsets());
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMapRef.current.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      sqzHistRef.current = null;
      sqzDotNoneRef.current = null;
      sqzDotOnRef.current = null;
      sqzDotOffRef.current = null;
      koncordeVerdeAreaRef.current = null;
      koncordeMarronAreaRef.current = null;
      koncordeAzulAreaRef.current = null;
      koncordeVerdeLineRef.current = null;
      koncordeMarronLineRef.current = null;
      koncordeAzulLineRef.current = null;
      koncordeMediaLineRef.current = null;
    };
  }, []);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      rsi30Ref.current = r30;
      rsi70Ref.current = r70;
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Squeeze Momentum pane — se coloca tras RSI y MACD si están activos
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.squeezeMomentum && !sqzHistRef.current) {
      // Cálculo dinámico del paneIndex: 1 + cuántos osciladores anteriores hay
      let paneIndex = 1;
      if (indicators.rsi) paneIndex += 1;
      if (indicators.macd) paneIndex += 1;

      // Histograma con color por punto
      const hist = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false, base: 0 },
        paneIndex,
      );
      // Tres LineSeries (una por estado de squeeze) — sólo dibujan puntos
      const mkDot = (color: string) =>
        chartRef.current!.addSeries(
          LineSeries,
          {
            color,
            lineWidth: 1,
            lineVisible: false,
            pointMarkersVisible: true,
            pointMarkersRadius: 3,
            priceLineVisible: false,
            lastValueVisible: false,
          },
          paneIndex,
        );
      const cfg = sqzConfigRef.current;
      const dotNone = mkDot(cfg.sqzNone);
      const dotOn = mkDot(cfg.sqzOn);
      const dotOff = mkDot(cfg.sqzOff);

      sqzHistRef.current = hist;
      sqzDotNoneRef.current = dotNone;
      sqzDotOnRef.current = dotOn;
      sqzDotOffRef.current = dotOff;

      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateSqueezeMomentum();
    } else if (!indicators.squeezeMomentum && sqzHistRef.current && chartRef.current) {
      chartRef.current.removeSeries(sqzHistRef.current);
      if (sqzDotNoneRef.current) chartRef.current.removeSeries(sqzDotNoneRef.current);
      if (sqzDotOnRef.current) chartRef.current.removeSeries(sqzDotOnRef.current);
      if (sqzDotOffRef.current) chartRef.current.removeSeries(sqzDotOffRef.current);
      sqzHistRef.current = null;
      sqzDotNoneRef.current = null;
      sqzDotOnRef.current = null;
      sqzDotOffRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.squeezeMomentum, indicators.rsi, indicators.macd]);

  // Koncorde pane — colocado despues de RSI/MACD/Squeeze segun cuales esten activos
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.koncorde && !koncordeVerdeAreaRef.current) {
      let paneIndex = 1;
      if (indicators.rsi) paneIndex += 1;
      if (indicators.macd) paneIndex += 1;
      if (indicators.squeezeMomentum) paneIndex += 1;

      const cfg = koncordeConfigRef.current;
      const mkBaseline = (areaColor: string) =>
        chartRef.current!.addSeries(
          BaselineSeries,
          {
            baseValue: { type: "price", price: 0 },
            // El contorno lo dan las LineSeries dedicadas — aqui invisible
            topLineColor: "rgba(0,0,0,0)",
            bottomLineColor: "rgba(0,0,0,0)",
            topFillColor1: alpha(areaColor, 0.55),
            topFillColor2: alpha(areaColor, 0.15),
            bottomFillColor1: alpha(areaColor, 0.15),
            bottomFillColor2: alpha(areaColor, 0.05),
            priceLineVisible: false,
            lastValueVisible: false,
          },
          paneIndex,
        );

      const verdeArea = mkBaseline(cfg.areaVerde);
      const marronArea = mkBaseline(cfg.areaMarron);
      const azulArea = mkBaseline(cfg.areaAzul);

      const mkLine = (color: string) =>
        chartRef.current!.addSeries(
          LineSeries,
          {
            color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          },
          paneIndex,
        );

      const verdeLine = mkLine(cfg.lineaVerde);
      const marronLine = mkLine(cfg.lineaMarron);
      const azulLine = mkLine(cfg.lineaAzul);
      const mediaLine = mkLine(cfg.lineaMedia);

      koncordeVerdeAreaRef.current = verdeArea;
      koncordeMarronAreaRef.current = marronArea;
      koncordeAzulAreaRef.current = azulArea;
      koncordeVerdeLineRef.current = verdeLine;
      koncordeMarronLineRef.current = marronLine;
      koncordeAzulLineRef.current = azulLine;
      koncordeMediaLineRef.current = mediaLine;

      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1.5);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateKoncorde();
    } else if (!indicators.koncorde && koncordeVerdeAreaRef.current && chartRef.current) {
      const remove = (s: ISeriesApi<"Baseline"> | ISeriesApi<"Line"> | null) => {
        if (s) chartRef.current!.removeSeries(s);
      };
      remove(koncordeVerdeAreaRef.current);
      remove(koncordeMarronAreaRef.current);
      remove(koncordeAzulAreaRef.current);
      remove(koncordeVerdeLineRef.current);
      remove(koncordeMarronLineRef.current);
      remove(koncordeAzulLineRef.current);
      remove(koncordeMediaLineRef.current);
      koncordeVerdeAreaRef.current = null;
      koncordeMarronAreaRef.current = null;
      koncordeAzulAreaRef.current = null;
      koncordeVerdeLineRef.current = null;
      koncordeMarronLineRef.current = null;
      koncordeAzulLineRef.current = null;
      koncordeMediaLineRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.koncorde, indicators.rsi, indicators.macd, indicators.squeezeMomentum]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
    if (sqzHistRef.current) sqzHistRef.current.applyOptions({ visible: v("squeezeMomentum") });
    if (sqzDotNoneRef.current) sqzDotNoneRef.current.applyOptions({ visible: v("squeezeMomentum") });
    if (sqzDotOnRef.current) sqzDotOnRef.current.applyOptions({ visible: v("squeezeMomentum") });
    if (sqzDotOffRef.current) sqzDotOffRef.current.applyOptions({ visible: v("squeezeMomentum") });
    const kv = v("koncorde");
    koncordeVerdeAreaRef.current?.applyOptions({ visible: kv });
    koncordeMarronAreaRef.current?.applyOptions({ visible: kv });
    koncordeAzulAreaRef.current?.applyOptions({ visible: kv });
    koncordeVerdeLineRef.current?.applyOptions({ visible: kv });
    koncordeMarronLineRef.current?.applyOptions({ visible: kv });
    koncordeAzulLineRef.current?.applyOptions({ visible: kv });
    koncordeMediaLineRef.current?.applyOptions({ visible: kv });
  }, [indicators, hidden]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  // Recolorea las series de squeeze y recalcula al cambiar params
  useEffect(() => {
    sqzDotNoneRef.current?.applyOptions({ color: sqzConfig.sqzNone });
    sqzDotOnRef.current?.applyOptions({ color: sqzConfig.sqzOn });
    sqzDotOffRef.current?.applyOptions({ color: sqzConfig.sqzOff });
    updateSqueezeMomentum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sqzConfig.bbLength,
    sqzConfig.bbMult,
    sqzConfig.kcLength,
    sqzConfig.kcMult,
    sqzConfig.useTrueRange,
    sqzConfig.histUp1,
    sqzConfig.histUp2,
    sqzConfig.histDown1,
    sqzConfig.histDown2,
    sqzConfig.sqzNone,
    sqzConfig.sqzOn,
    sqzConfig.sqzOff,
  ]);

  // Recolor + recalculo de Koncorde cuando cambia su config
  useEffect(() => {
    const cfg = koncordeConfig;
    koncordeVerdeAreaRef.current?.applyOptions({
      topFillColor1: alpha(cfg.areaVerde, 0.55),
      topFillColor2: alpha(cfg.areaVerde, 0.15),
      bottomFillColor1: alpha(cfg.areaVerde, 0.15),
      bottomFillColor2: alpha(cfg.areaVerde, 0.05),
    });
    koncordeMarronAreaRef.current?.applyOptions({
      topFillColor1: alpha(cfg.areaMarron, 0.55),
      topFillColor2: alpha(cfg.areaMarron, 0.15),
      bottomFillColor1: alpha(cfg.areaMarron, 0.15),
      bottomFillColor2: alpha(cfg.areaMarron, 0.05),
    });
    koncordeAzulAreaRef.current?.applyOptions({
      topFillColor1: alpha(cfg.areaAzul, 0.55),
      topFillColor2: alpha(cfg.areaAzul, 0.15),
      bottomFillColor1: alpha(cfg.areaAzul, 0.15),
      bottomFillColor2: alpha(cfg.areaAzul, 0.05),
    });
    koncordeVerdeLineRef.current?.applyOptions({ color: cfg.lineaVerde });
    koncordeMarronLineRef.current?.applyOptions({ color: cfg.lineaMarron });
    koncordeAzulLineRef.current?.applyOptions({ color: cfg.lineaAzul });
    koncordeMediaLineRef.current?.applyOptions({ color: cfg.lineaMedia });
    updateKoncorde();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    koncordeConfig.m,
    koncordeConfig.bollLength,
    koncordeConfig.bollMult,
    koncordeConfig.mfiLength,
    koncordeConfig.rsiLength,
    koncordeConfig.stochLength,
    koncordeConfig.stochSmooth,
    koncordeConfig.rangeLookback,
    koncordeConfig.areaVerde,
    koncordeConfig.areaMarron,
    koncordeConfig.areaAzul,
    koncordeConfig.lineaVerde,
    koncordeConfig.lineaMarron,
    koncordeConfig.lineaAzul,
    koncordeConfig.lineaMedia,
  ]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (!map.has(pl.id)) {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: TV_COLORS.blue,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, symbol]);

  // Cursor style when drawing tools are active + reset measure on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor =
        tool === "hline" || tool === "measure" ? "crosshair" : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
  }, [tool]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const data = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0)
      rsi30Ref.current.setData([
        { time: data[0].time, value: 30 },
        { time: data[data.length - 1].time, value: 30 },
      ]);
    if (rsi70Ref.current && data.length > 0)
      rsi70Ref.current.setData([
        { time: data[0].time, value: 70 },
        { time: data[data.length - 1].time, value: 70 },
      ]);
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  function updateSqueezeMomentum() {
    const c = candlesRef.current;
    const hist = sqzHistRef.current;
    if (c.length === 0 || !hist) return;
    const cfg = sqzConfigRef.current;
    const points = calculateSqueezeMomentum(c, {
      bbLength: cfg.bbLength,
      bbMult: cfg.bbMult,
      kcLength: cfg.kcLength,
      kcMult: cfg.kcMult,
      useTrueRange: cfg.useTrueRange,
    });

    // Mapeo color del histograma según lo que devuelve el indicador
    const colorMap: Record<string, string> = {
      lime: cfg.histUp1,
      green: cfg.histUp2,
      red: cfg.histDown1,
      maroon: cfg.histDown2,
    };

    // Histograma — sólo puntos con val no nulo
    const histData = points
      .filter((p) => p.val !== null)
      .map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.val as number,
        color: p.histColor ? colorMap[p.histColor] : cfg.histUp2,
      }));
    hist.setData(histData);

    // Tres series de puntos: una por estado. Las velas en otro estado se omiten
    // (la serie sólo recibe los puntos que le corresponden).
    const dotNone: { time: UTCTimestamp; value: number }[] = [];
    const dotOn: { time: UTCTimestamp; value: number }[] = [];
    const dotOff: { time: UTCTimestamp; value: number }[] = [];
    for (const p of points) {
      if (p.sqzState === null) continue;
      const entry = { time: p.time as UTCTimestamp, value: 0 };
      if (p.sqzState === "none") dotNone.push(entry);
      else if (p.sqzState === "on") dotOn.push(entry);
      else dotOff.push(entry);
    }
    sqzDotNoneRef.current?.setData(dotNone);
    sqzDotOnRef.current?.setData(dotOn);
    sqzDotOffRef.current?.setData(dotOff);

    const last = points.at(-1);
    setLastValues((prev) => ({
      ...prev,
      squeezeVal: last?.val ?? undefined,
      squeezeState: last?.sqzState ?? undefined,
    }));
  }

  function updateKoncorde() {
    const c = candlesRef.current;
    if (c.length === 0 || !koncordeVerdeAreaRef.current) return;
    const cfg = koncordeConfigRef.current;
    const pts = calculateKoncorde(c, {
      m: cfg.m,
      bollLength: cfg.bollLength,
      bollMult: cfg.bollMult,
      mfiLength: cfg.mfiLength,
      rsiLength: cfg.rsiLength,
      stochLength: cfg.stochLength,
      stochSmooth: cfg.stochSmooth,
      rangeLookback: cfg.rangeLookback,
    });

    const verdeData: { time: UTCTimestamp; value: number }[] = [];
    const marronData: { time: UTCTimestamp; value: number }[] = [];
    const azulData: { time: UTCTimestamp; value: number }[] = [];
    const mediaData: { time: UTCTimestamp; value: number }[] = [];
    for (const p of pts) {
      const t = p.time as UTCTimestamp;
      if (p.verde !== null) verdeData.push({ time: t, value: p.verde });
      if (p.marron !== null) marronData.push({ time: t, value: p.marron });
      if (p.azul !== null) azulData.push({ time: t, value: p.azul });
      if (p.media !== null) mediaData.push({ time: t, value: p.media });
    }
    koncordeVerdeAreaRef.current.setData(verdeData);
    koncordeMarronAreaRef.current?.setData(marronData);
    koncordeAzulAreaRef.current?.setData(azulData);
    koncordeVerdeLineRef.current?.setData(verdeData);
    koncordeMarronLineRef.current?.setData(marronData);
    koncordeAzulLineRef.current?.setData(azulData);
    koncordeMediaLineRef.current?.setData(mediaData);

    const last = pts.at(-1);
    setLastValues((prev) => ({
      ...prev,
      koncordeAzul: last?.azul ?? undefined,
      koncordeMarron: last?.marron ?? undefined,
      koncordeVerde: last?.verde ?? undefined,
      koncordeMedia: last?.media ?? undefined,
    }));
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    async function load() {
      try {
        const klines = await fetchKlines(symbol, timeframe, 1000);
        if (cancelled) return;
        candlesRef.current = klines;
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            })),
          );
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              value: k.volume,
              color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            })),
          );
        }
        updateEMAs();
        updateRSI();
        updateMACD();
        updateSqueezeMomentum();
        updateKoncorde();
        // Tras el cambio de simbolo/timeframe forzamos auto-escala del eje de
        // precio y encajamos el rango temporal. Si no, el eje conservaria los
        // limites del simbolo anterior y las velas nuevas caerian fuera del
        // area visible. Esto solo se ejecuta en el load inicial, no en ticks
        // WS, para que el chart no "salte" durante el streaming en vivo.
        if (chartRef.current) {
          try {
            chartRef.current.priceScale("right").applyOptions({ autoScale: true });
          } catch {}
          try {
            chartRef.current.priceScale("left").applyOptions({ autoScale: true });
          } catch {}
          // Reescalar tambien los paneles secundarios (RSI, MACD, Squeeze) por
          // si quedo congelada su escala tras un zoom manual previo.
          try {
            for (const pane of chartRef.current.panes()) {
              for (const series of pane.getSeries()) {
                try {
                  series.priceScale().applyOptions({ autoScale: true });
                } catch {}
              }
            }
          } catch {}
          chartRef.current.timeScale().fitContent();
        }
        requestAnimationFrame(() => recomputePaneOffsets());

        if (klines.length > 0) {
          const last = klines[klines.length - 1];
          const prev = klines[klines.length - 2] ?? last;
          setLastPrice({
            value: last.close,
            pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
          });
        }

        const ws = getBinanceWS();
        unsub = ws.subscribeKline({
          symbol,
          interval: timeframe,
          onCandle: (k) => {
            if (!candleSeriesRef.current) return;
            const arr = candlesRef.current;
            const lastCandle = arr[arr.length - 1];
            if (lastCandle && lastCandle.time === k.time) {
              arr[arr.length - 1] = k;
            } else if (!lastCandle || k.time > lastCandle.time) {
              arr.push(k);
              if (arr.length > 2000) arr.shift();
            } else {
              return;
            }
            candleSeriesRef.current.update({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            });
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: k.time as UTCTimestamp,
                value: k.volume,
                color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
              });
            }
            updateEMAs();
            updateRSI();
            updateMACD();
            updateSqueezeMomentum();
            updateKoncorde();
            const prev = arr[arr.length - 2] ?? lastCandle;
            setLastPrice({
              value: k.close,
              pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
            });
          },
        });
      } catch (e) {
        console.error("Failed to load chart data:", e);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [symbol, timeframe]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;
  const sqzPaneIdx =
    1 + (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
  const koncordePaneIdx =
    1 +
    (indicators.rsi ? 1 : 0) +
    (indicators.macd ? 1 : 0) +
    (indicators.squeezeMomentum ? 1 : 0);

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter(
        (c) => c.time >= start && c.time <= end,
      );
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          volume={volume}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
        />
      );
    }
  }
  void renderTick;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {measureRender}

      {/* Volume Profile (VRVP) overlay sobre el pane principal */}
      {paneOffsets[0] && (
        <VolumeProfileOverlay
          chart={chartRef.current}
          candleSeries={candleSeriesRef.current}
          candles={candlesRef.current}
          paneTop={paneOffsets[0].top}
          paneHeight={paneOffsets[0].height}
          config={vrvpConfig}
          visible={indicators.vrvp && !hidden.vrvp}
          redrawTick={renderTick + (lastPrice?.value ?? 0)}
        />
      )}

      <VolumeProfileSettingsDialog
        open={vrvpDialogOpen}
        onOpenChange={setVrvpDialogOpen}
      />

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + (isMobile ? 6 : 12), left: isMobile ? 6 : 12, right: isMobile ? 6 : undefined }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: en desktop muestra simbolo+timeframe+OHLC en hover. En movil
            esa info ya esta en el header de la app — la ocultamos para liberar
            espacio. Solo el bloque OHLC en hover se mantiene en desktop. */}
        {!isMobile && (
          <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
            <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
              <span className="text-tv-text">{symbol}</span>
              <span className="text-tv-text-muted">·</span>
              <span className="uppercase text-tv-text-muted">{timeframe}</span>
              <span className="text-tv-text-muted">·</span>
              <span className="text-tv-text-muted">Binance</span>
            </div>
            {hover && (
              <div className="flex items-center gap-x-3 text-[11px]">
                <span className="text-tv-text-muted">
                  O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
                </span>
                <span className="text-tv-text-muted">
                  H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
                </span>
                <span className="text-tv-text-muted">
                  L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
                </span>
                <span className="text-tv-text-muted">
                  C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
                </span>
                <span className={greenOrRed(hover.pct)}>
                  {hover.pct >= 0 ? "+" : ""}
                  {hover.pct.toFixed(2)}%
                </span>
                <span className="text-tv-text-muted">
                  Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Row 2: precio en vivo + % */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`font-semibold tabular-nums ${isMobile ? "text-base" : "text-lg"} ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Pills indicadores: en desktop apiladas vertical; en movil una fila scrolleable */}
        <div
          className={
            isMobile
              ? "mt-1 -mx-1 flex max-w-[calc(100vw-12px)] items-center gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "mt-1 flex flex-col items-start gap-1"
          }
        >
          {indicators.ema20 && (
            <IndicatorPill
              compact={isMobile}
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              compact={isMobile}
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              compact={isMobile}
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              compact={isMobile}
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
          {indicators.vrvp && (
            <IndicatorPill
              compact={isMobile}
              name="VRVP"
              color={INDICATOR_COLORS.vrvp}
              hidden={hidden.vrvp}
              onToggleHide={() => toggleHidden("vrvp")}
              onSettings={() => setVrvpDialogOpen(true)}
              onRemove={() => removeIndicator("vrvp")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: isMobile ? 6 : 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            compact={isMobile}
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: isMobile ? 6 : 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            compact={isMobile}
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}

      {/* Squeeze Momentum pane label */}
      {indicators.squeezeMomentum && paneOffsets[sqzPaneIdx] && (
        <div
          style={{ top: paneOffsets[sqzPaneIdx].top + 6, left: isMobile ? 6 : 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            compact={isMobile}
            name={`SQZMOM ${sqzConfig.bbLength}, ${sqzConfig.kcLength}`}
            value={
              lastValues.squeezeVal !== undefined
                ? `${lastValues.squeezeVal.toFixed(2)} · ${lastValues.squeezeState ?? "—"}`
                : undefined
            }
            color={INDICATOR_COLORS.squeezeMomentum}
            hidden={hidden.squeezeMomentum}
            onToggleHide={() => toggleHidden("squeezeMomentum")}
            onSettings={() => setSqzDialogOpen(true)}
            onRemove={() => removeIndicator("squeezeMomentum")}
          />
        </div>
      )}

      <SqueezeMomentumSettingsDialog
        open={sqzDialogOpen}
        onOpenChange={setSqzDialogOpen}
      />

      {/* Koncorde pane label — pill multi-color con los 4 valores */}
      {indicators.koncorde && paneOffsets[koncordePaneIdx] && (
        <div
          style={{ top: paneOffsets[koncordePaneIdx].top + 6, left: isMobile ? 6 : 12 }}
          className="pointer-events-none absolute z-10 flex items-center gap-1.5"
        >
          <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded bg-tv-panel/95 px-2 py-0.5 text-[11px] shadow-sm ring-1 ring-tv-border backdrop-blur">
            <span className="font-medium text-tv-text">Koncorde</span>
            {!isMobile && (
              <div className="flex items-center gap-2 tabular-nums">
                <span style={{ color: koncordeConfig.lineaAzul }}>
                  A {lastValues.koncordeAzul !== undefined ? lastValues.koncordeAzul.toFixed(1) : "—"}
                </span>
                <span style={{ color: koncordeConfig.lineaMarron }}>
                  M {lastValues.koncordeMarron !== undefined ? lastValues.koncordeMarron.toFixed(1) : "—"}
                </span>
                <span style={{ color: koncordeConfig.lineaVerde }}>
                  V {lastValues.koncordeVerde !== undefined ? lastValues.koncordeVerde.toFixed(1) : "—"}
                </span>
                <span style={{ color: koncordeConfig.lineaMedia }}>
                  μ {lastValues.koncordeMedia !== undefined ? lastValues.koncordeMedia.toFixed(1) : "—"}
                </span>
              </div>
            )}
            <button
              onClick={() => toggleHidden("koncorde")}
              className="rounded p-0.5 text-tv-text-dim hover:bg-tv-panel-hover hover:text-tv-text"
              aria-label={hidden.koncorde ? "Mostrar" : "Ocultar"}
              title={hidden.koncorde ? "Mostrar" : "Ocultar"}
            >
              {hidden.koncorde ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setKoncordeDialogOpen(true)}
              className="rounded p-0.5 text-tv-text-dim hover:bg-tv-panel-hover hover:text-tv-text"
              aria-label="Configurar"
              title="Configurar"
            >
              <Settings className="h-3 w-3" />
            </button>
            <button
              onClick={() => removeIndicator("koncorde")}
              className="rounded p-0.5 text-tv-text-dim hover:bg-tv-panel-hover hover:text-tv-red"
              aria-label="Eliminar"
              title="Eliminar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <KoncordeSettingsDialog
        open={koncordeDialogOpen}
        onOpenChange={setKoncordeDialogOpen}
      />
    </div>
  );
}
