"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/binance/types";
import { calculateVolumeProfile } from "@/lib/indicators";
import type { VrvpConfig } from "@/lib/store/chart-store";

interface Props {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  candles: Candle[];
  paneTop: number;
  paneHeight: number;
  config: VrvpConfig;
  visible: boolean;
  /** Tick que cambia con cada update de velas o config — fuerza re-render */
  redrawTick: number;
}

/**
 * Volume Profile (VRVP) — overlay de canvas absoluto sobre el pane principal.
 *
 * Calcula el perfil sobre las velas actualmente visibles y dibuja un histograma
 * horizontal anclado al lado derecho/izquierdo del chart. Se suscribe al cambio
 * de rango visible para recomputar y redibujar.
 */
export function VolumeProfileOverlay({
  chart,
  candleSeries,
  candles,
  paneTop,
  paneHeight,
  config,
  visible,
  redrawTick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Cache de las velas y config — leídas desde el handler de rango sin re-suscribir
  const candlesRef = useRef(candles);
  const configRef = useRef(config);
  const chartRef = useRef(chart);
  const seriesRef = useRef(candleSeries);
  const rafRef = useRef<number | null>(null);

  // Mantenemos los refs sincronizados con los props vía effect (evita asignar
  // durante render, que dispara react-hooks/refs)
  useEffect(() => {
    candlesRef.current = candles;
    configRef.current = config;
    chartRef.current = chart;
    seriesRef.current = candleSeries;
  }, [candles, config, chart, candleSeries]);

  // Lógica principal de dibujo. Lee el rango visible, calcula el perfil y
  // pinta sobre el canvas. Coalescemos con requestAnimationFrame.
  function scheduleDraw() {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }

  function draw() {
    const canvas = canvasRef.current;
    const c = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !c || !series) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ajuste de tamaño del canvas (HiDPI)
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (!visible) return;

    // 1. Rango lógico visible → subset de velas
    const range = c.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const all = candlesRef.current;
    if (all.length === 0) return;
    const fromIdx = Math.max(0, Math.floor(range.from));
    const toIdx = Math.min(all.length - 1, Math.ceil(range.to));
    if (toIdx < fromIdx) return;
    const slice = all.slice(fromIdx, toIdx + 1);
    if (slice.length === 0) return;

    const cfg = configRef.current;

    // 2. Calcular el perfil
    const profile = calculateVolumeProfile(slice, {
      rowSize: cfg.rowSize,
      valueAreaPercent: cfg.valueAreaPercent,
    });
    if (!profile) return;

    // 3. Geometría del recuadro
    const boxWidth = Math.max(20, (cssWidth * cfg.widthPercent) / 100);
    const boxX = cfg.placement === "right" ? cssWidth - boxWidth : 0;
    // El histograma se "dibuja" desde el lado externo (eje de precio) hacia el centro
    const baseX = cfg.placement === "right" ? cssWidth : 0;
    const dirSign = cfg.placement === "right" ? -1 : 1;

    // Fondo muy tenue del recuadro para diferenciarlo visualmente
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(boxX, 0, boxWidth, cssHeight);

    // 4. Coordenadas de cada fila en píxeles (Y) usando priceToCoordinate
    const rows = profile.rows;
    const yCoords: (number | null)[] = new Array(rows.length + 1);
    for (let r = 0; r <= rows.length; r++) {
      const price =
        r === 0 ? rows[0].priceLow : rows[r - 1].priceHigh;
      const y = series.priceToCoordinate(price);
      yCoords[r] = y;
    }

    const maxVol = profile.maxVolume;
    if (maxVol <= 0) return;

    // 5. Dibujar barras apiladas (up + down) por fila
    for (let r = 0; r < rows.length; r++) {
      const yTop = yCoords[r + 1];
      const yBot = yCoords[r];
      if (yTop === null || yBot === null) continue;
      // En lightweight-charts el eje Y aumenta hacia abajo, pero priceLow está
      // abajo y priceHigh arriba → yBot > yTop (numéricamente).
      const top = Math.min(yTop, yBot);
      const bot = Math.max(yTop, yBot);
      // Si la fila cae completamente fuera del área visible, skip
      if (bot < 0 || top > cssHeight) continue;
      const h = Math.max(1, bot - top - 0.5);

      const row = rows[r];
      const upW = (row.upVolume / maxVol) * boxWidth;
      const downW = (row.downVolume / maxVol) * boxWidth;

      // Down (rojo) primero, luego up (verde) apilado encima en el lado interior
      // Layout: empezamos en baseX y avanzamos hacia el centro en dirSign.
      if (downW > 0) {
        ctx.fillStyle = cfg.downColor + "B3"; // ~70% alpha
        ctx.fillRect(baseX, top, dirSign * downW, h);
      }
      if (upW > 0) {
        ctx.fillStyle = cfg.upColor + "B3";
        ctx.fillRect(baseX + dirSign * downW, top, dirSign * upW, h);
      }
    }

    // 6. Líneas POC / VAH / VAL (horizontales sobre todo el chart)
    const lineY = (idx: number) => {
      const yTop = yCoords[idx + 1];
      const yBot = yCoords[idx];
      if (yTop === null || yBot === null) return null;
      return (yTop + yBot) / 2;
    };

    if (cfg.showPOC) {
      const y = lineY(profile.pocIndex);
      if (y !== null) {
        ctx.strokeStyle = cfg.pocColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }
    }
    if (cfg.showVAH) {
      const y = lineY(profile.vahIndex);
      if (y !== null) {
        ctx.strokeStyle = cfg.pocColor + "99";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }
    }
    if (cfg.showVAL) {
      const y = lineY(profile.valIndex);
      if (y !== null) {
        ctx.strokeStyle = cfg.pocColor + "99";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // Suscripción a cambios de rango visible — recalcula y redibuja
  useEffect(() => {
    const c = chart;
    if (!c) return;
    const ts = c.timeScale();
    const handler = () => scheduleDraw();
    ts.subscribeVisibleLogicalRangeChange(handler);
    ts.subscribeVisibleTimeRangeChange(handler);
    scheduleDraw();
    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(handler);
      ts.unsubscribeVisibleTimeRangeChange(handler);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, candleSeries]);

  // Redibujar cuando cambian inputs externos (velas, config, visibilidad, tamaño)
  useEffect(() => {
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, config, visible, paneTop, paneHeight, redrawTick]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: paneTop,
        left: 0,
        width: "100%",
        height: paneHeight,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}
