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
  DEFAULT_KONCORDE_CONFIG,
  type KoncordeConfig,
} from "@/lib/store/chart-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function KoncordeSettingsDialog({ open, onOpenChange }: Props) {
  const config = useChartStore((s) => s.koncordeConfig);
  const setConfig = useChartStore((s) => s.setKoncordeConfig);
  const reset = useChartStore((s) => s.resetKoncordeConfig);

  const [draft, setDraft] = useState<KoncordeConfig>(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  function update<K extends keyof KoncordeConfig>(
    key: K,
    value: KoncordeConfig[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function apply() {
    setConfig(draft);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Koncorde (Blai5) — Configuración
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <NumField label="EMA marrón / pvim / nvim (m)" value={draft.m} onChange={(n) => update("m", n)} integer />
            <NumField label="Bollinger length" value={draft.bollLength} onChange={(n) => update("bollLength", n)} integer />
            <NumField label="Bollinger mult" value={draft.bollMult} onChange={(n) => update("bollMult", n)} />
            <NumField label="MFI length" value={draft.mfiLength} onChange={(n) => update("mfiLength", n)} integer />
            <NumField label="RSI length" value={draft.rsiLength} onChange={(n) => update("rsiLength", n)} integer />
            <NumField label="Stoch length" value={draft.stochLength} onChange={(n) => update("stochLength", n)} integer />
            <NumField label="Stoch smooth (SMA %K)" value={draft.stochSmooth} onChange={(n) => update("stochSmooth", n)} integer />
            <NumField label="Range lookback (90)" value={draft.rangeLookback} onChange={(n) => update("rangeLookback", n)} integer />
          </div>

          <div className="border-t border-tv-border pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Colores de áreas
            </p>
            <ColorField label="Área verde (tendencia)" value={draft.areaVerde} onChange={(v) => update("areaVerde", v)} />
            <ColorField label="Área marrón (minoristas)" value={draft.areaMarron} onChange={(v) => update("areaMarron", v)} />
            <ColorField label="Área azul (instituciones)" value={draft.areaAzul} onChange={(v) => update("areaAzul", v)} />
          </div>

          <div className="border-t border-tv-border pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Colores de contorno y media
            </p>
            <ColorField label="Línea verde" value={draft.lineaVerde} onChange={(v) => update("lineaVerde", v)} />
            <ColorField label="Línea marrón" value={draft.lineaMarron} onChange={(v) => update("lineaMarron", v)} />
            <ColorField label="Línea azul" value={draft.lineaAzul} onChange={(v) => update("lineaAzul", v)} />
            <ColorField label="Media (EMA marrón)" value={draft.lineaMedia} onChange={(v) => update("lineaMedia", v)} />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setDraft(DEFAULT_KONCORDE_CONFIG);
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
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  integer?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <NumericInput
        value={value}
        onCommit={onChange}
        integer={integer}
        min={1}
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
