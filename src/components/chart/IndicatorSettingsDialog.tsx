"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  useChartStore,
  DEFAULT_CONFIG,
  DEFAULT_INDICATOR_COLORS,
  type IndicatorColors,
  type IndicatorKey,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  ema20: "EMA — Slot 1",
  ema50: "EMA — Slot 2",
  ema200: "EMA — Slot 3",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  vrvp: "Volume Profile (VRVP)",
  squeezeMomentum: "Squeeze Momentum (LazyBear)",
  koncorde: "Koncorde (Blai5)",
  dmiAdx: "DMI + ADX (Key Level)",
};

/** Borrador de colores editable desde este dialog. */
interface ColorDraft {
  ema20: string;
  ema50: string;
  ema200: string;
  rsi: string;
  macdLine: string;
  macdSignal: string;
  macdHistUp: string;
  macdHistDown: string;
  volumeUp: string;
  volumeDown: string;
}

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);
  const indicatorColors = useChartStore((s) => s.indicatorColors);
  const setIndicatorColor = useChartStore((s) => s.setIndicatorColor);

  const open = target !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-sm overflow-y-auto bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            target={target}
            config={config}
            colors={indicatorColors}
            onSave={(configPatch, colorPatch) => {
              setConfig(configPatch);
              for (const k of Object.keys(colorPatch) as (keyof IndicatorColors)[]) {
                const c = colorPatch[k];
                if (c !== undefined) setIndicatorColor(k, c);
              }
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              for (const k of Object.keys(DEFAULT_INDICATOR_COLORS) as (keyof IndicatorColors)[]) {
                setIndicatorColor(k, DEFAULT_INDICATOR_COLORS[k]);
              }
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: typeof DEFAULT_CONFIG;
  colors: IndicatorColors;
  onSave: (
    configPatch: Partial<typeof DEFAULT_CONFIG>,
    colorPatch: Partial<IndicatorColors>,
  ) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, colors, onSave, onReset }: FormProps) {
  const [draft, setDraft] = useState({
    ema20: config.ema20,
    ema50: config.ema50,
    ema200: config.ema200,
    rsi: config.rsi,
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
  });

  const [colorDraft, setColorDraft] = useState<ColorDraft>(colors);

  useEffect(() => {
    setDraft({
      ema20: config.ema20,
      ema50: config.ema50,
      ema200: config.ema200,
      rsi: config.rsi,
      macdFast: config.macdFast,
      macdSlow: config.macdSlow,
      macdSignal: config.macdSignal,
    });
    setColorDraft(colors);
  }, [config, colors, target]);

  function save() {
    let cfg: Partial<typeof DEFAULT_CONFIG> = {};
    let col: Partial<IndicatorColors> = {};

    if (target === "ema20") {
      cfg = { ema20: clamp(draft.ema20, 2, 500) };
      col = { ema20: colorDraft.ema20 };
    } else if (target === "ema50") {
      cfg = { ema50: clamp(draft.ema50, 2, 500) };
      col = { ema50: colorDraft.ema50 };
    } else if (target === "ema200") {
      cfg = { ema200: clamp(draft.ema200, 2, 500) };
      col = { ema200: colorDraft.ema200 };
    } else if (target === "rsi") {
      cfg = { rsi: clamp(draft.rsi, 2, 100) };
      col = { rsi: colorDraft.rsi };
    } else if (target === "macd") {
      cfg = {
        macdFast: clamp(draft.macdFast, 2, 100),
        macdSlow: clamp(draft.macdSlow, 2, 200),
        macdSignal: clamp(draft.macdSignal, 2, 100),
      };
      col = {
        macdLine: colorDraft.macdLine,
        macdSignal: colorDraft.macdSignal,
        macdHistUp: colorDraft.macdHistUp,
        macdHistDown: colorDraft.macdHistDown,
      };
    } else if (target === "volume") {
      col = {
        volumeUp: colorDraft.volumeUp,
        volumeDown: colorDraft.volumeDown,
      };
    }

    onSave(cfg, col);
  }

  return (
    <div className="flex flex-col gap-3">
      {(target === "ema20" || target === "ema50" || target === "ema200") && (
        <>
          <Field
            label="Período"
            value={draft[target]}
            onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
          />
          <ColorField
            label="Color de la línea"
            value={colorDraft[target]}
            onChange={(c) => setColorDraft((d) => ({ ...d, [target]: c }))}
          />
        </>
      )}
      {target === "rsi" && (
        <>
          <Field
            label="Período"
            value={draft.rsi}
            onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))}
          />
          <ColorField
            label="Color RSI"
            value={colorDraft.rsi}
            onChange={(c) => setColorDraft((d) => ({ ...d, rsi: c }))}
          />
        </>
      )}
      {target === "macd" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="Rápida"
              value={draft.macdFast}
              onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))}
            />
            <Field
              label="Lenta"
              value={draft.macdSlow}
              onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))}
            />
            <Field
              label="Señal"
              value={draft.macdSignal}
              onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))}
            />
          </div>
          <div className="border-t border-tv-border pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Colores
            </p>
            <ColorField label="Línea MACD" value={colorDraft.macdLine} onChange={(c) => setColorDraft((d) => ({ ...d, macdLine: c }))} />
            <ColorField label="Línea Signal" value={colorDraft.macdSignal} onChange={(c) => setColorDraft((d) => ({ ...d, macdSignal: c }))} />
            <ColorField label="Histograma +" value={colorDraft.macdHistUp} onChange={(c) => setColorDraft((d) => ({ ...d, macdHistUp: c }))} />
            <ColorField label="Histograma −" value={colorDraft.macdHistDown} onChange={(c) => setColorDraft((d) => ({ ...d, macdHistDown: c }))} />
          </div>
        </>
      )}
      {target === "volume" && (
        <div>
          <ColorField label="Volumen alcista" value={colorDraft.volumeUp} onChange={(c) => setColorDraft((d) => ({ ...d, volumeUp: c }))} />
          <ColorField label="Volumen bajista" value={colorDraft.volumeDown} onChange={(c) => setColorDraft((d) => ({ ...d, volumeDown: c }))} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text"
        >
          Reset defaults
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <NumericInput
        value={value}
        onCommit={onChange}
        min={2}
        max={500}
        integer
        ariaLabel={label}
        className="bg-tv-bg"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-tv-text">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-tv-border bg-tv-bg"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-24 bg-tv-bg text-xs tabular-nums"
        />
      </span>
    </label>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
