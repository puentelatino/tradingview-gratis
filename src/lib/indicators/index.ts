import type { Candle } from "@/lib/binance/types";

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Simple Moving Average
 */
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

/**
 * Exponential Moving Average — seeded with SMA of first `period` candles.
 */
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += candles[i].close;
  prev /= period;
  out.push({ time: candles[period - 1].time, value: prev });
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

/**
 * RSI (Wilder) — period typically 14.
 */
export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  let rs = loss === 0 ? 100 : gain / loss;
  out.push({ time: candles[period].time, value: 100 - 100 / (1 + rs) });
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    rs = loss === 0 ? 100 : gain / loss;
    out.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
  }
  return out;
}

/**
 * MACD — fast EMA, slow EMA, signal EMA of the MACD line.
 * Defaults: 12 / 26 / 9.
 */
export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDPoint[] {
  if (candles.length < slow + signal) return [];
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  // align: emaSlow starts later
  const slowStartTime = emaSlow[0].time;
  const fastByTime = new Map(emaFast.map((p) => [p.time, p.value]));
  const macdLine: IndicatorPoint[] = [];
  for (const p of emaSlow) {
    const f = fastByTime.get(p.time);
    if (f !== undefined) macdLine.push({ time: p.time, value: f - p.value });
  }
  // signal = EMA of MACD line. Build synthetic candles for ema()
  const synth: Candle[] = macdLine.map((p) => ({
    time: p.time,
    open: p.value,
    high: p.value,
    low: p.value,
    close: p.value,
    volume: 0,
  }));
  const sig = ema(synth, signal);
  const sigByTime = new Map(sig.map((p) => [p.time, p.value]));
  const out: MACDPoint[] = [];
  for (const p of macdLine) {
    const s = sigByTime.get(p.time);
    if (s === undefined) continue;
    out.push({ time: p.time, macd: p.value, signal: s, histogram: p.value - s });
  }
  void slowStartTime;
  return out;
}

// ─── Squeeze Momentum (LazyBear, SQZMOM_LB) ──────────────────────────────────

export type SqueezeState = "on" | "off" | "none";
export type SqueezeHistColor = "lime" | "green" | "red" | "maroon";

export interface SqueezeMomentumOptions {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  useTrueRange: boolean;
}

export interface SqueezeMomentumPoint {
  time: number;
  val: number | null;
  sqzState: SqueezeState | null;
  histColor: SqueezeHistColor | null;
}

/**
 * Desviación estándar poblacional sobre los `period` últimos closes.
 * Coincide con `stdev()` de Pine Script (normaliza por N, no por N-1).
 */
function stdevPop(values: number[], period: number, endIdx: number): number {
  let sum = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) sum += values[i];
  const mean = sum / period;
  let acc = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    const d = values[i] - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / period);
}

/** True Range de la vela i (necesita la vela previa para gap-aware) */
function trueRangeAt(candles: Candle[], i: number): number {
  const c = candles[i];
  if (i === 0) return c.high - c.low;
  const prevClose = candles[i - 1].close;
  return Math.max(
    c.high - c.low,
    Math.abs(c.high - prevClose),
    Math.abs(c.low - prevClose),
  );
}

/**
 * Regresión lineal por mínimos cuadrados sobre `period` puntos terminando en
 * `endIdx`. Devuelve el valor previsto en el último punto (offset 0), tal como
 * `linreg(source, length, 0)` de Pine Script.
 *
 * Modelo: y = a + b*x donde x = 0..period-1 (x más reciente = period-1).
 * Pendiente b = (period*Σxy − Σx*Σy) / (period*Σx² − (Σx)²)
 * Intercepto a = (Σy − b*Σx) / period
 * Predicción en x = period-1 → a + b*(period-1).
 */
function linregLast(values: number[], period: number, endIdx: number): number {
  const n = period;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let k = 0; k < n; k++) {
    const x = k;
    const y = values[endIdx - (n - 1) + k];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return intercept + slope * (n - 1);
}

/**
 * Squeeze Momentum Indicator (LazyBear) — replica del script original.
 *
 * Combina Bollinger Bands y Keltner Channels para detectar squeezes
 * (compresiones de volatilidad) y una regresión lineal sobre la distancia del
 * precio al midpoint del rango para estimar el momentum.
 *
 * Por cada vela devuelve:
 *  - val:       valor del histograma (linreg del momentum). null si no hay
 *               histórico suficiente.
 *  - sqzState:  'on' (BB dentro de KC, mercado comprimido),
 *               'off' (BB fuera de KC, expansión activa),
 *               'none' (estado neutral). null si aún no hay datos.
 *  - histColor: lime/green/red/maroon según signo de val y si crece o decrece
 *               respecto al punto previo.
 */
export function calculateSqueezeMomentum(
  candles: Candle[],
  options: SqueezeMomentumOptions,
): SqueezeMomentumPoint[] {
  const n = candles.length;
  const out: SqueezeMomentumPoint[] = new Array(n);
  if (n === 0) return out;

  const { bbLength, bbMult, kcLength, kcMult, useTrueRange } = options;

  // Precomputamos arrays de close, high, low y range para acceso O(1)
  const closes = new Array<number>(n);
  const highs = new Array<number>(n);
  const lows = new Array<number>(n);
  const ranges = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    closes[i] = candles[i].close;
    highs[i] = candles[i].high;
    lows[i] = candles[i].low;
    ranges[i] = useTrueRange ? trueRangeAt(candles, i) : candles[i].high - candles[i].low;
  }

  // Para linreg necesitamos la serie "source - avg(avg(hh, ll), sma)" en cada
  // punto de la ventana de kcLength. La construimos progresivamente.
  const momentumSrc = new Array<number>(n);

  // SMAs incrementales: mantenemos sumas móviles
  let sumCloseBB = 0; // sum de closes en ventana bbLength
  let sumCloseKC = 0; // sum de closes en ventana kcLength
  let sumRangeKC = 0; // sum de range en ventana kcLength

  // Para highest(high, kcLength) y lowest(low, kcLength) usamos un escaneo
  // lineal sobre la ventana — es O(kcLength) por vela pero kcLength es pequeño
  // (típico 20) y mantiene el código simple sin estructuras deque.

  for (let i = 0; i < n; i++) {
    sumCloseBB += closes[i];
    if (i >= bbLength) sumCloseBB -= closes[i - bbLength];

    sumCloseKC += closes[i];
    if (i >= kcLength) sumCloseKC -= closes[i - kcLength];

    sumRangeKC += ranges[i];
    if (i >= kcLength) sumRangeKC -= ranges[i - kcLength];

    const time = candles[i].time;

    // ¿Hay suficiente histórico para BB y KC?
    const hasBB = i >= bbLength - 1;
    const hasKC = i >= kcLength - 1;

    if (!hasBB || !hasKC) {
      out[i] = { time, val: null, sqzState: null, histColor: null };
      continue;
    }

    // Bandas de Bollinger (OJO: el script original usa multKC en la dev de BB,
    // no bbMult. Replicamos esa peculiaridad — `dev = multKC * stdev(...)`)
    const basis = sumCloseBB / bbLength;
    const dev = kcMult * stdevPop(closes, bbLength, i);
    void bbMult;
    const upperBB = basis + dev;
    const lowerBB = basis - dev;

    // Keltner Channels
    const ma = sumCloseKC / kcLength;
    const rangema = sumRangeKC / kcLength;
    const upperKC = ma + rangema * kcMult;
    const lowerKC = ma - rangema * kcMult;

    const sqzOn = lowerBB > lowerKC && upperBB < upperKC;
    const sqzOff = lowerBB < lowerKC && upperBB > upperKC;
    const sqzState: SqueezeState = sqzOn ? "on" : sqzOff ? "off" : "none";

    // highest(high, kcLength) y lowest(low, kcLength) sobre la ventana cerrada
    let hh = -Infinity;
    let ll = Infinity;
    for (let k = i - kcLength + 1; k <= i; k++) {
      if (highs[k] > hh) hh = highs[k];
      if (lows[k] < ll) ll = lows[k];
    }
    const mid = (hh + ll) / 2;
    const avgMidSma = (mid + ma) / 2;
    momentumSrc[i] = closes[i] - avgMidSma;

    // Necesitamos kcLength puntos de momentumSrc para el linreg
    if (i < kcLength - 1 + (kcLength - 1)) {
      // Aún no hay kcLength valores válidos en momentumSrc; el primer punto
      // válido de momentumSrc está en i = kcLength-1, así que necesitamos
      // i >= 2*(kcLength-1) para tener una ventana completa.
    }
    const linregStart = i - kcLength + 1;
    if (linregStart < kcLength - 1) {
      // Faltan puntos de momentumSrc completos en la ventana de linreg
      out[i] = { time, val: null, sqzState, histColor: null };
      continue;
    }

    const val = linregLast(momentumSrc, kcLength, i);

    // Color del histograma según signo + tendencia respecto al punto previo
    const prev = out[i - 1];
    const prevVal = prev && prev.val !== null ? prev.val : 0;
    let histColor: SqueezeHistColor;
    if (val > 0) {
      histColor = val > prevVal ? "lime" : "green";
    } else {
      histColor = val < prevVal ? "red" : "maroon";
    }

    out[i] = { time, val, sqzState, histColor };
  }

  return out;
}

// ─── Volume Profile (VRVP) ───────────────────────────────────────────────────

export interface VolumeProfileRow {
  priceLow: number;
  priceHigh: number;
  upVolume: number;
  downVolume: number;
  totalVolume: number;
}

export interface VolumeProfileOptions {
  /** Número de filas en las que dividir el rango de precio visible */
  rowSize: number;
  /** Porcentaje del volumen total que define el Value Area (0-100) */
  valueAreaPercent: number;
}

export interface VolumeProfileResult {
  rows: VolumeProfileRow[];
  /** Volumen máximo entre todas las filas (para escalar el ancho de las barras) */
  maxVolume: number;
  /** Volumen total acumulado de todas las filas */
  totalVolume: number;
  /** Índice de la fila POC (Point of Control) — la de mayor volumen */
  pocIndex: number;
  /** Índice de la fila VAH (Value Area High) */
  vahIndex: number;
  /** Índice de la fila VAL (Value Area Low) */
  valIndex: number;
  /** Precio mínimo cubierto por el perfil */
  priceMin: number;
  /** Precio máximo cubierto por el perfil */
  priceMax: number;
}

/**
 * Volume Profile sobre un conjunto de velas.
 *
 * Algoritmo:
 *   1. Calcula min/max de precio en las velas.
 *   2. Divide el rango en `rowSize` filas equiespaciadas.
 *   3. Para cada vela, distribuye su volumen proporcionalmente entre las filas
 *      que su rango [low, high] toca. Si close >= open → upVolume, si no → downVolume.
 *   4. POC = fila con mayor totalVolume.
 *   5. Value Area: partiendo del POC se añaden filas adyacentes (la de mayor
 *      volumen arriba/abajo) hasta cubrir `valueAreaPercent` % del volumen total.
 *
 * Performance: usa Float64Array para sumas de volumen.
 */
export function calculateVolumeProfile(
  candles: Candle[],
  options: VolumeProfileOptions,
): VolumeProfileResult | null {
  const rowSize = Math.max(1, Math.floor(options.rowSize));
  if (candles.length === 0) return null;

  // 1. Rango de precios
  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.low < priceMin) priceMin = c.low;
    if (c.high > priceMax) priceMax = c.high;
  }
  if (!isFinite(priceMin) || !isFinite(priceMax) || priceMax <= priceMin) {
    return null;
  }

  const totalRange = priceMax - priceMin;
  const rowHeight = totalRange / rowSize;

  // 2. Acumuladores
  const upVol = new Float64Array(rowSize);
  const downVol = new Float64Array(rowSize);

  // 3. Distribuir volumen de cada vela
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.volume <= 0) continue;
    const range = c.high - c.low;
    const isUp = c.close >= c.open;

    if (range <= 0) {
      // Vela "doji" sin rango — todo el volumen va a la fila que contiene su precio
      const idx = Math.min(
        rowSize - 1,
        Math.max(0, Math.floor((c.close - priceMin) / rowHeight)),
      );
      if (isUp) upVol[idx] += c.volume;
      else downVol[idx] += c.volume;
      continue;
    }

    // Índices de las filas tocadas
    const lowIdx = Math.max(0, Math.floor((c.low - priceMin) / rowHeight));
    const highIdx = Math.min(
      rowSize - 1,
      Math.floor((c.high - priceMin) / rowHeight),
    );

    if (lowIdx === highIdx) {
      if (isUp) upVol[lowIdx] += c.volume;
      else downVol[lowIdx] += c.volume;
      continue;
    }

    // Distribución proporcional: cada fila recibe (overlap_con_la_vela / range) * volume
    const volPerUnit = c.volume / range;
    for (let r = lowIdx; r <= highIdx; r++) {
      const rowLow = priceMin + r * rowHeight;
      const rowHigh = rowLow + rowHeight;
      const overlap = Math.min(rowHigh, c.high) - Math.max(rowLow, c.low);
      if (overlap <= 0) continue;
      const share = overlap * volPerUnit;
      if (isUp) upVol[r] += share;
      else downVol[r] += share;
    }
  }

  // 4. Construir filas, hallar POC y total
  const rows: VolumeProfileRow[] = new Array(rowSize);
  let maxVolume = 0;
  let pocIndex = 0;
  let totalVolume = 0;
  for (let r = 0; r < rowSize; r++) {
    const u = upVol[r];
    const d = downVol[r];
    const t = u + d;
    rows[r] = {
      priceLow: priceMin + r * rowHeight,
      priceHigh: priceMin + (r + 1) * rowHeight,
      upVolume: u,
      downVolume: d,
      totalVolume: t,
    };
    totalVolume += t;
    if (t > maxVolume) {
      maxVolume = t;
      pocIndex = r;
    }
  }

  // 5. Value Area — expandir desde POC hacia arriba/abajo eligiendo siempre
  //    la dirección con mayor volumen marginal, hasta cubrir el % objetivo.
  const target = (totalVolume * Math.max(0, Math.min(100, options.valueAreaPercent))) / 100;
  let lo = pocIndex;
  let hi = pocIndex;
  let acc = rows[pocIndex].totalVolume;
  while (acc < target && (lo > 0 || hi < rowSize - 1)) {
    const upNext = hi < rowSize - 1 ? rows[hi + 1].totalVolume : -1;
    const downNext = lo > 0 ? rows[lo - 1].totalVolume : -1;
    if (upNext < 0 && downNext < 0) break;
    if (upNext >= downNext) {
      hi += 1;
      acc += rows[hi].totalVolume;
    } else {
      lo -= 1;
      acc += rows[lo].totalVolume;
    }
  }

  return {
    rows,
    maxVolume,
    totalVolume,
    pocIndex,
    vahIndex: hi,
    valIndex: lo,
    priceMin,
    priceMax,
  };
}
