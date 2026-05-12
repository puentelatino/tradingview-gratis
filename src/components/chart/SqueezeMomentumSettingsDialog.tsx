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
import {
  useChartStore,
  DEFAULT_SQUEEZE_MOMENTUM_CONFIG,
  type SqueezeMomentumConfig,
} from "@/lib/store/chart-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SqueezeMomentumSettingsDialog({ open, onOpenChange }: Props) {
  const config = useChartStore((s) => s.squeezeMomentumConfig);
  const setConfig = useChartStore((s) => s.setSqueezeMomentumConfig);
  const reset = useChartStore((s) => s.resetSqueezeMomentumConfig);

  // Borrador local: evita recomputar el indicador con cada keystroke
  const [draft, setDraft] = useState<SqueezeMomentumConfig>(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  function update<K extends keyof SqueezeMomentumConfig>(
    key: K,
    value: SqueezeMomentumConfig[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function apply() {
    setConfig({
      bbLength: clampInt(draft.bbLength, 2, 500),
      bbMult: clamp(draft.bbMult, 0.1, 10),
      kcLength: clampInt(draft.kcLength, 2, 500),
      kcMult: clamp(draft.kcMult, 0.1, 10),
      useTrueRange: draft.useTrueRange,
      histUp1: draft.histUp1,
      histUp2: draft.histUp2,
      histDown1: draft.histDown1,
      histDown2: draft.histDown2,
      sqzNone: draft.sqzNone,
      sqzOn: draft.sqzOn,
      sqzOff: draft.sqzOff,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Squeeze Momentum (LazyBear) — Configuración
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="BB Length"
              value={draft.bbLength}
              onChange={(n) => update("bbLength", n)}
              step={1}
            />
            <NumberField
              label="BB Mult"
              value={draft.bbMult}
              onChange={(n) => update("bbMult", n)}
              step={0.1}
            />
            <NumberField
              label="KC Length"
              value={draft.kcLength}
              onChange={(n) => update("kcLength", n)}
              step={1}
            />
            <NumberField
              label="KC Mult"
              value={draft.kcMult}
              onChange={(n) => update("kcMult", n)}
              step={0.1}
            />
          </div>

          <CheckboxField
            label="Usar True Range (KC)"
            checked={draft.useTrueRange}
            onChange={(v) => update("useTrueRange", v)}
          />

          <div className="mt-1 border-t border-tv-border pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Colores del histograma
            </p>
            <div className="flex flex-col gap-2">
              <ColorField
                label="Subida creciente"
                value={draft.histUp1}
                onChange={(v) => update("histUp1", v)}
              />
              <ColorField
                label="Subida decreciente"
                value={draft.histUp2}
                onChange={(v) => update("histUp2", v)}
              />
              <ColorField
                label="Bajada creciente"
                value={draft.histDown1}
                onChange={(v) => update("histDown1", v)}
              />
              <ColorField
                label="Bajada decreciente"
                value={draft.histDown2}
                onChange={(v) => update("histDown2", v)}
              />
            </div>
          </div>

          <div className="border-t border-tv-border pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Colores del squeeze
            </p>
            <div className="flex flex-col gap-2">
              <ColorField
                label="Sin squeeze"
                value={draft.sqzNone}
                onChange={(v) => update("sqzNone", v)}
              />
              <ColorField
                label="Squeeze On"
                value={draft.sqzOn}
                onChange={(v) => update("sqzOn", v)}
              />
              <ColorField
                label="Squeeze Off"
                value={draft.sqzOff}
                onChange={(v) => update("sqzOff", v)}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setDraft(DEFAULT_SQUEEZE_MOMENTUM_CONFIG);
            }}
            className="text-tv-text-muted hover:text-tv-text"
          >
            Reset defaults
          </Button>
          <Button size="sm" onClick={apply} className="bg-tv-blue hover:bg-tv-blue/90">
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums"
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
    <label className="flex items-center justify-between gap-2">
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

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-tv-blue"
      />
      <span className="text-tv-text">{label}</span>
    </label>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function clampInt(n: number, min: number, max: number): number {
  return clamp(Math.floor(n), min, max);
}
