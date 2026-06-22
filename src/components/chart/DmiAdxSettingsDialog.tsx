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
  DEFAULT_DMI_ADX_CONFIG,
  type DmiAdxConfig,
  type DmiAdxOverlay,
} from "@/lib/store/chart-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DmiAdxSettingsDialog({ open, onOpenChange }: Props) {
  const config = useChartStore((s) => s.dmiAdxConfig);
  const setConfig = useChartStore((s) => s.setDmiAdxConfig);
  const reset = useChartStore((s) => s.resetDmiAdxConfig);

  const [draft, setDraft] = useState<DmiAdxConfig>(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  function update<K extends keyof DmiAdxConfig>(key: K, value: DmiAdxConfig[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function apply() {
    setConfig({
      adxLength: clampInt(draft.adxLength, 1, 200),
      diLength: clampInt(draft.diLength, 1, 200),
      keyLevel: clampInt(draft.keyLevel, 0, 100),
      adxColor: draft.adxColor,
      plusDIColor: draft.plusDIColor,
      minusDIColor: draft.minusDIColor,
      keyLevelColor: draft.keyLevelColor,
      keyLevelDashed: draft.keyLevelDashed,
      overlayOn: draft.overlayOn,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            DMI + ADX (Key Level) — Configuración
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <NumField label="ADX Smoothing" value={draft.adxLength} onChange={(n) => update("adxLength", n)} />
            <NumField label="DI Length" value={draft.diLength} onChange={(n) => update("diLength", n)} />
            <NumField label="Key Level" value={draft.keyLevel} onChange={(n) => update("keyLevel", n)} />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Mostrar en panel
            </span>
            <select
              value={draft.overlayOn}
              onChange={(e) => update("overlayOn", e.target.value as DmiAdxOverlay)}
              className="rounded border border-tv-border bg-tv-bg px-2 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
            >
              <option value="own">Panel propio</option>
              <option value="squeeze">Squeeze Momentum</option>
            </select>
          </label>

          <div className="border-t border-tv-border pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Colores
            </p>
            <ColorField label="ADX" value={draft.adxColor} onChange={(v) => update("adxColor", v)} />
            <ColorField label="+DI" value={draft.plusDIColor} onChange={(v) => update("plusDIColor", v)} />
            <ColorField label="−DI" value={draft.minusDIColor} onChange={(v) => update("minusDIColor", v)} />
            <ColorField label="Key Level" value={draft.keyLevelColor} onChange={(v) => update("keyLevelColor", v)} />
          </div>

          <CheckboxField
            label="Key Level discontinua (dashed)"
            checked={draft.keyLevelDashed}
            onChange={(v) => update("keyLevelDashed", v)}
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setDraft(DEFAULT_DMI_ADX_CONFIG);
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

function NumField({
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
        integer
        min={0}
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

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}
