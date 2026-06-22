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

// ─── Koncorde (Blai5) ────────────────────────────────────────────────────────

export interface KoncordeOptions {
  m: number;
  bollLength: number;
  bollMult: number;
  mfiLength: number;
  rsiLength: number;
  stochLength: number;
  stochSmooth: number;
  rangeLookback: number;
}

export interface KoncordePoint {
  time: number;
  azul: number | null;
  marron: number | null;
  verde: number | null;
  media: number | null;
}

/** SMA sobre un array numerico. Devuelve null hasta tener `period` valores. */
function smaArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** EMA sobre array numerico, sembrada con SMA(period). */
function emaArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;
  out[period - 1] = seed;
  let prev = seed;
  for (let i = period; i < n; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Rolling sum de los ultimos `period` valores (null hasta tener ventana llena). */
function sumArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += values[i];
    if (i >= period) s -= values[i - period];
    if (i >= period - 1) out[i] = s;
  }
  return out;
}

/** Maximo en ventana movil de `period` (null hasta tener ventana llena). */
function highestArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < period - 1) continue;
    let m = -Infinity;
    for (let k = i - period + 1; k <= i; k++) if (values[k] > m) m = values[k];
    out[i] = m;
  }
  return out;
}

/** Minimo en ventana movil de `period`. */
function lowestArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < period - 1) continue;
    let m = Infinity;
    for (let k = i - period + 1; k <= i; k++) if (values[k] < m) m = values[k];
    out[i] = m;
  }
  return out;
}

/** Desviacion poblacional rolling sobre array numerico. */
function stdevPopArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let k = i - period + 1; k <= i; k++) sum += values[k];
    const mean = sum / period;
    let acc = 0;
    for (let k = i - period + 1; k <= i; k++) {
      const d = values[k] - mean;
      acc += d * d;
    }
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

/**
 * RSI clasico sobre array numerico, periodo Wilder. Devuelve null hasta tener
 * `period` cambios validos.
 */
function rsiArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  const firstRs = loss === 0 ? 100 : gain / loss;
  out[period] = 100 - 100 / (1 + firstRs);
  for (let i = period + 1; i < n; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    const rs = loss === 0 ? 100 : gain / loss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

/**
 * PVI (Positive Volume Index, Norman Fosback) — version Koncorde.
 *
 * Recurrencia: si volume[i] > volume[i-1] entonces
 *   pvi[i] = pvi[i-1] + ((close[i] - close[i-1]) / close[i-1]) * pvi[i-1]
 * en caso contrario pvi[i] = pvi[i-1].
 *
 * Inicializacion: el Pine v2 original deja la primera barra en estado na y
 * la convencion estandar (Fosback) es arrancar en 1000. La rama
 * `(na(pvi[1]) ? pvi[1] : sval)` del codigo original es ambigua/buggy en la
 * primera vela; usar 1000 produce el resultado que todos los publishers
 * privados de Blai5 muestran y es lo que esperan los usuarios.
 */
export function calculatePVI(candles: Candle[]): number[] {
  const n = candles.length;
  const out = new Array<number>(n);
  if (n === 0) return out;
  out[0] = 1000;
  for (let i = 1; i < n; i++) {
    const prev = out[i - 1];
    if (
      candles[i].volume > candles[i - 1].volume &&
      candles[i - 1].close !== 0
    ) {
      out[i] = prev + ((candles[i].close - candles[i - 1].close) / candles[i - 1].close) * prev;
    } else {
      out[i] = prev;
    }
  }
  return out;
}

/** NVI: igual que PVI pero la condicion es `volume[i] < volume[i-1]`. */
export function calculateNVI(candles: Candle[]): number[] {
  const n = candles.length;
  const out = new Array<number>(n);
  if (n === 0) return out;
  out[0] = 1000;
  for (let i = 1; i < n; i++) {
    const prev = out[i - 1];
    if (
      candles[i].volume < candles[i - 1].volume &&
      candles[i - 1].close !== 0
    ) {
      out[i] = prev + ((candles[i].close - candles[i - 1].close) / candles[i - 1].close) * prev;
    } else {
      out[i] = prev;
    }
  }
  return out;
}

/**
 * MFI a la "manera Pine v2" del Koncorde: NO es el MFI clasico de Wilder.
 * Es un RSI sobre flujos de dinero, donde:
 *   upper = sum( volume * (change(hlc3) > 0 ? hlc3 : 0), length )
 *   lower = sum( volume * (change(hlc3) < 0 ? hlc3 : 0), length )
 *   xmf   = 100 - 100 / (1 + upper / lower)
 *
 * En el codigo original la comparacion incluye igualdad (<=0 y >=0 producen 0),
 * lo cual es asimetrico — replicamos el comportamiento exacto.
 */
function koncordeMFI(
  hlc3: number[],
  volume: number[],
  length: number,
): (number | null)[] {
  const n = hlc3.length;
  // change(src) en Pine v2 = src - src[1]; la primera barra es na (=> 0).
  const upArr = new Array<number>(n).fill(0);
  const dnArr = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const ch = hlc3[i] - hlc3[i - 1];
    // upper: ch <= 0 ⇒ 0 (asi que solo cuenta cuando ch > 0)
    if (ch > 0) upArr[i] = volume[i] * hlc3[i];
    // lower: ch >= 0 ⇒ 0 (solo cuando ch < 0)
    if (ch < 0) dnArr[i] = volume[i] * hlc3[i];
  }
  const upperSum = sumArr(upArr, length);
  const lowerSum = sumArr(dnArr, length);
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const u = upperSum[i];
    const l = lowerSum[i];
    if (u === null || l === null) continue;
    if (l === 0) {
      out[i] = 100;
    } else {
      const rs = u / l;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

/**
 * Calcula el Koncorde de Blai5 punto a punto. Devuelve null en las barras
 * iniciales donde alguno de los componentes aun no esta disponible.
 *
 * Composicion (replica exacta del Pine v2):
 *   tprice  = ohlc4
 *   pvi/nvi recursivos
 *   oscp    = (pvi - ema(pvi,m)) * 100 / (highest(pvim,90) - lowest(pvim,90))
 *   azul    = (nvi - ema(nvi,m)) * 100 / (highest(nvim,90) - lowest(nvim,90))
 *   xmf     = MFI peculiar
 *   BollOsc = ((tprice - mid) / (upper - lower)) * 100 con bandas de Bollinger
 *             de tprice (length=25, mult=2)
 *   xrsi    = rsi(tprice, 14)
 *   stoc    = SMA( 100 * (tprice - lowest(low,21)) / (highest(high,21) - lowest(low,21)), 3 )
 *   marron  = (xrsi + xmf + BollOsc + stoc/3) / 2
 *   verde   = marron + oscp
 *   media   = ema(marron, m)
 */
export function calculateKoncorde(
  candles: Candle[],
  options: KoncordeOptions,
): KoncordePoint[] {
  const n = candles.length;
  const out: KoncordePoint[] = new Array(n);
  if (n === 0) return out;

  const {
    m,
    bollLength,
    bollMult,
    mfiLength,
    rsiLength,
    stochLength,
    stochSmooth,
    rangeLookback,
  } = options;

  // Precomputos
  const close = new Array<number>(n);
  const high = new Array<number>(n);
  const low = new Array<number>(n);
  const volume = new Array<number>(n);
  const hlc3 = new Array<number>(n);
  const ohlc4 = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    close[i] = c.close;
    high[i] = c.high;
    low[i] = c.low;
    volume[i] = c.volume;
    hlc3[i] = (c.high + c.low + c.close) / 3;
    ohlc4[i] = (c.open + c.high + c.low + c.close) / 4;
  }
  const tprice = ohlc4;

  // PVI / NVI y sus EMA(m) + rangos rolling 90
  const pvi = calculatePVI(candles);
  const nvi = calculateNVI(candles);
  const pvim = emaArr(pvi, m);
  const nvim = emaArr(nvi, m);
  const pvimax = highestArr(pvim.map((v) => v ?? -Infinity), rangeLookback);
  const pvimin = lowestArr(pvim.map((v) => v ?? Infinity), rangeLookback);
  const nvimax = highestArr(nvim.map((v) => v ?? -Infinity), rangeLookback);
  const nvimin = lowestArr(nvim.map((v) => v ?? Infinity), rangeLookback);

  // Bollinger Oscillator sobre tprice
  const basis = smaArr(tprice, bollLength);
  const dev = stdevPopArr(tprice, bollLength);

  // RSI(tprice, rsiLength)
  const xrsi = rsiArr(tprice, rsiLength);

  // MFI peculiar
  const xmf = koncordeMFI(hlc3, volume, mfiLength);

  // Stochastic sobre tprice con highest(high)/lowest(low) de stochLength
  const hh = highestArr(high, stochLength);
  const ll = lowestArr(low, stochLength);
  const kRaw = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const h = hh[i];
    const l = ll[i];
    if (h === null || l === null || h === l) continue;
    kRaw[i] = (100 * (tprice[i] - l)) / (h - l);
  }
  const stoc = smaArr(kRaw, stochSmooth);

  // Pasamos marron como array para luego sacar su EMA(m)
  const marronArr = new Array<number | null>(n).fill(null);
  const verdeArr = new Array<number | null>(n).fill(null);
  const azulArr = new Array<number | null>(n).fill(null);

  for (let i = 0; i < n; i++) {
    const time = candles[i].time;

    // azul: (nvi - nvim) * 100 / (nvimax - nvimin)
    const nvm = nvim[i];
    const nvMax = nvimax[i];
    const nvMin = nvimin[i];
    let azul: number | null = null;
    if (nvm !== null && nvMax !== null && nvMin !== null && nvMax !== nvMin) {
      azul = ((nvi[i] - nvm) * 100) / (nvMax - nvMin);
      azulArr[i] = azul;
    }

    // oscp: (pvi - pvim) * 100 / (pvimax - pvimin)
    const pvm = pvim[i];
    const pvMax = pvimax[i];
    const pvMin = pvimin[i];
    let oscp: number | null = null;
    if (pvm !== null && pvMax !== null && pvMin !== null && pvMax !== pvMin) {
      oscp = ((pvi[i] - pvm) * 100) / (pvMax - pvMin);
    }

    // BollOsc
    let bollOsc: number | null = null;
    const b = basis[i];
    const d = dev[i];
    if (b !== null && d !== null) {
      const upper = b + bollMult * d;
      const lower = b - bollMult * d;
      const OB1 = (upper + lower) / 2;
      const OB2 = upper - lower;
      if (OB2 !== 0) bollOsc = ((tprice[i] - OB1) / OB2) * 100;
    }

    // marron: (xrsi + xmf + BollOsc + stoc/3) / 2
    let marron: number | null = null;
    if (
      xrsi[i] !== null &&
      xmf[i] !== null &&
      bollOsc !== null &&
      stoc[i] !== null
    ) {
      marron = (((xrsi[i] as number) + (xmf[i] as number) + bollOsc + (stoc[i] as number) / 3) / 2);
      marronArr[i] = marron;
    }

    // verde: marron + oscp
    let verde: number | null = null;
    if (marron !== null && oscp !== null) {
      verde = marron + oscp;
      verdeArr[i] = verde;
    }

    out[i] = { time, azul, marron, verde, media: null };
  }

  // media = ema(marron, m) — recorremos marronArr saltando los null iniciales
  // y sembrando la EMA cuando hay m valores consecutivos disponibles.
  let firstValid = -1;
  for (let i = 0; i < n; i++) {
    if (marronArr[i] !== null) {
      firstValid = i;
      break;
    }
  }
  if (firstValid >= 0 && firstValid + m - 1 < n) {
    let seed = 0;
    let ok = true;
    for (let i = firstValid; i < firstValid + m; i++) {
      const v = marronArr[i];
      if (v === null) {
        ok = false;
        break;
      }
      seed += v;
    }
    if (ok) {
      const k = 2 / (m + 1);
      let prev = seed / m;
      out[firstValid + m - 1].media = prev;
      for (let i = firstValid + m; i < n; i++) {
        const v = marronArr[i];
        if (v === null) continue;
        prev = v * k + prev * (1 - k);
        out[i].media = prev;
      }
    }
  }

  // Devolvemos verde/marron/azul ya escritos en out — copiamos de los arrays
  // por si en algun punto los recolocamos
  for (let i = 0; i < n; i++) {
    out[i].verde = verdeArr[i];
    out[i].marron = marronArr[i];
    out[i].azul = azulArr[i];
  }

  return out;
}

// ─── DMI + ADX + Key Level ───────────────────────────────────────────────────

export interface DmiAdxOptions {
  /** Suavizado del ADX (adxlen) */
  adxLength: number;
  /** Longitud de los DI (dilen) */
  diLength: number;
}

export interface DmiAdxPoint {
  time: number;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
}

/**
 * RMA de Wilder sobre un array numerico, replicando `ta.rma(src, period)` de
 * Pine Script:
 *   - Devuelve null en los primeros (period-1) indices.
 *   - El primer valor NO nulo (indice period-1) es la SMA de los primeros
 *     `period` valores.
 *   - A partir de ahi aplica la recurrencia de Wilder:
 *       rma[i] = (rma[i-1] * (period - 1) + src[i]) / period
 */
function rmaArr(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period < 1 || n < period) return out;
  // Siembra: SMA de los primeros `period` valores en el indice period-1
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < n; i++) {
    prev = (prev * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Replica `fixnan` de Pine: sustituye cada valor null/NaN/Infinity por el
 * ultimo valor valido anterior. Mantiene null solo hasta el primer valido.
 */
function fixnanArr(values: (number | null)[]): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  let last: number | null = null;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v !== null && isFinite(v)) {
      last = v;
      out[i] = v;
    } else {
      out[i] = last; // arrastra el ultimo valido (null si aun no hay)
    }
  }
  return out;
}

/**
 * Directional Movement Index + ADX.
 *
 * Replica exacta del Pine:
 *   up      = high[i] - high[i-1]
 *   down    = low[i-1] - low[i]
 *   plusDM  = (up > down && up > 0)   ? up   : 0
 *   minusDM = (down > up && down > 0) ? down : 0
 *   trS     = rma(tr, diLength)
 *   plusDI  = fixnan(100 * rma(plusDM, diLength)  / trS)
 *   minusDI = fixnan(100 * rma(minusDM, diLength) / trS)
 *   sum     = plusDI + minusDI
 *   dx      = abs(plusDI - minusDI) / (sum == 0 ? 1 : sum)
 *   adx     = 100 * rma(dx, adxLength)
 *
 * En la barra 0 no hay cambio direccional definible (change=na en Pine): se
 * inicializan plusDM/minusDM a 0 y tr a (high-low). Tras suficientes barras la
 * RMA converge, asi que el matiz de la primera barra no afecta al ADX visible.
 */
export function calculateDmiAdx(
  candles: Candle[],
  options: DmiAdxOptions,
): DmiAdxPoint[] {
  const n = candles.length;
  const out: DmiAdxPoint[] = new Array(n);
  if (n === 0) return out;

  const { adxLength, diLength } = options;

  // Movimiento direccional bruto y true range por vela
  const plusDM = new Array<number>(n).fill(0);
  const minusDM = new Array<number>(n).fill(0);
  const tr = new Array<number>(n);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
    tr[i] = trueRangeAt(candles, i);
  }

  const trS = rmaArr(tr, diLength);
  const plusRma = rmaArr(plusDM, diLength);
  const minusRma = rmaArr(minusDM, diLength);

  // plusDI / minusDI brutos (con posibles divisiones invalidas) + fixnan
  const plusRaw = new Array<number | null>(n).fill(null);
  const minusRaw = new Array<number | null>(n).fill(null);
  for (let i = 0; i < n; i++) {
    const t = trS[i];
    const p = plusRma[i];
    const m = minusRma[i];
    if (t !== null && t !== 0 && p !== null) plusRaw[i] = (100 * p) / t;
    if (t !== null && t !== 0 && m !== null) minusRaw[i] = (100 * m) / t;
  }
  const plusDI = fixnanArr(plusRaw);
  const minusDI = fixnanArr(minusRaw);

  // dx → rma(dx, adxLength)
  const dxRaw = new Array<number>(n).fill(0);
  const dxValid = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    const p = plusDI[i];
    const m = minusDI[i];
    if (p === null || m === null) continue;
    const sum = p + m;
    dxRaw[i] = Math.abs(p - m) / (sum === 0 ? 1 : sum);
    dxValid[i] = true;
  }
  // El primer dx valido marca el arranque para la RMA del ADX
  let firstDx = -1;
  for (let i = 0; i < n; i++) {
    if (dxValid[i]) {
      firstDx = i;
      break;
    }
  }
  const adxOut = new Array<number | null>(n).fill(null);
  if (firstDx >= 0 && firstDx + adxLength - 1 < n) {
    // Sembramos la RMA del ADX con la SMA de los primeros `adxLength` dx
    let seed = 0;
    for (let k = firstDx; k < firstDx + adxLength; k++) seed += dxRaw[k];
    let prev = seed / adxLength;
    adxOut[firstDx + adxLength - 1] = 100 * prev;
    for (let i = firstDx + adxLength; i < n; i++) {
      prev = (prev * (adxLength - 1) + dxRaw[i]) / adxLength;
      adxOut[i] = 100 * prev;
    }
  }

  for (let i = 0; i < n; i++) {
    out[i] = {
      time: candles[i].time,
      adx: adxOut[i],
      plusDI: plusDI[i],
      minusDI: minusDI[i],
    };
  }
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
