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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useChartStore,
  DEFAULT_VRVP_CONFIG,
  type VrvpConfig,
  type VrvpPlacement,
} from "@/lib/store/chart-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function VolumeProfileSettingsDialog({ open, onOpenChange }: Props) {
  const config = useChartStore((s) => s.vrvpConfig);
  const setVrvpConfig = useChartStore((s) => s.setVrvpConfig);
  const resetVrvpConfig = useChartStore((s) => s.resetVrvpConfig);

  // Borrador local para no recomputar el chart con cada keystroke
  const [draft, setDraft] = useState<VrvpConfig>(config);
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  function update<K extends keyof VrvpConfig>(key: K, value: VrvpConfig[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function apply() {
    setVrvpConfig({
      rowSize: clamp(Math.floor(draft.rowSize), 10, 5000),
      valueAreaPercent: clamp(draft.valueAreaPercent, 1, 100),
      widthPercent: clamp(draft.widthPercent, 5, 50),
      placement: draft.placement,
      showPOC: draft.showPOC,
      showVAH: draft.showVAH,
      showVAL: draft.showVAL,
      upColor: draft.upColor,
      downColor: draft.downColor,
      pocColor: draft.pocColor,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Volume Profile (VRVP) — Configuración
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="inputs" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="inputs">Entradas</TabsTrigger>
            <TabsTrigger value="style">Estilo</TabsTrigger>
            <TabsTrigger value="visibility">Visibilidad</TabsTrigger>
          </TabsList>

          {/* ── Entradas de datos ─────────────────────────────────────── */}
          <TabsContent value="inputs" className="flex flex-col gap-3 pt-2">
            <FieldSelect
              label="Diseño de filas"
              value="rowsize"
              options={[{ value: "rowsize", label: "Número de filas" }]}
              onChange={() => undefined}
            />
            <NumberField
              label="Tamaño de la fila"
              value={draft.rowSize}
              onChange={(n) => update("rowSize", n)}
              min={10}
              max={5000}
            />
            <FieldSelect
              label="Volumen"
              value="total"
              options={[{ value: "total", label: "Total" }]}
              onChange={() => undefined}
            />
            <NumberField
              label="Volumen del área de valor (%)"
              value={draft.valueAreaPercent}
              onChange={(n) => update("valueAreaPercent", n)}
              min={1}
              max={100}
            />
          </TabsContent>

          {/* ── Estilo ────────────────────────────────────────────────── */}
          <TabsContent value="style" className="flex flex-col gap-3 pt-2">
            <NumberField
              label="Ancho del recuadro (%)"
              value={draft.widthPercent}
              onChange={(n) => update("widthPercent", n)}
              min={5}
              max={50}
            />
            <FieldSelect
              label="Colocación"
              value={draft.placement}
              options={[
                { value: "right", label: "Derecha" },
                { value: "left", label: "Izquierda" },
              ]}
              onChange={(v) => update("placement", v as VrvpPlacement)}
            />
            <ColorField
              label="Volumen ascendente"
              value={draft.upColor}
              onChange={(v) => update("upColor", v)}
            />
            <ColorField
              label="Volumen descendente"
              value={draft.downColor}
              onChange={(v) => update("downColor", v)}
            />
            <ColorField
              label="Color POC / VA"
              value={draft.pocColor}
              onChange={(v) => update("pocColor", v)}
            />
          </TabsContent>

          {/* ── Visibilidad ───────────────────────────────────────────── */}
          <TabsContent value="visibility" className="flex flex-col gap-2 pt-2">
            <CheckboxField
              label="POC (Point of Control)"
              checked={draft.showPOC}
              onChange={(v) => update("showPOC", v)}
            />
            <CheckboxField
              label="VAH (Value Area High)"
              checked={draft.showVAH}
              onChange={(v) => update("showVAH", v)}
            />
            <CheckboxField
              label="VAL (Value Area Low)"
              checked={draft.showVAL}
              onChange={(v) => update("showVAL", v)}
            />
            <CheckboxField
              label="Developing POC"
              checked={false}
              onChange={() => undefined}
              disabled
            />
            <CheckboxField
              label="Developing VA"
              checked={false}
              onChange={() => undefined}
              disabled
            />
          </TabsContent>
        </Tabs>

        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetVrvpConfig();
              setDraft(DEFAULT_VRVP_CONFIG);
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
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={min}
        max={max}
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

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-tv-border bg-tv-bg px-2 py-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? "opacity-40" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
