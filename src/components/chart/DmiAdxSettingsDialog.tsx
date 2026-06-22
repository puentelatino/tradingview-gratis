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
  type LineThickness,
} from "@/lib/store/chart-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Claves de cada linea para mapear su show/color/width sin repetir codigo. */
const LINES: {
  name: string;
  showKey: keyof DmiAdxConfig;
  colorKey: keyof DmiAdxConfig;
  widthKey: keyof DmiAdxConfig;
}[] = [
  { name: "ADX", showKey: "showADX", colorKey: "adxColor", widthKey: "adxWidth" },
  { name: "+DI", showKey: "showPlusDI", colorKey: "plusDIColor", widthKey: "plusDIWidth" },
  { name: "−DI", showKey: "showMinusDI", colorKey: "minusDIColor", widthKey: "minusDIWidth" },
  { name: "Key Level", showKey: "showKeyLevel", colorKey: "keyLevelColor", widthKey: "keyLevelWidth" },
];

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
      ...draft,
      adxLength: clampInt(draft.adxLength, 1, 200),
      diLength: clampInt(draft.diLength, 1, 200),
      keyLevel: clampInt(draft.keyLevel, 0, 100),
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
              Líneas
            </p>
            <div className="flex flex-col gap-2">
              {LINES.map((ln) => (
                <LineRow
                  key={ln.name}
                  name={ln.name}
                  show={draft[ln.showKey] as boolean}
                  color={draft[ln.colorKey] as string}
                  width={draft[ln.widthKey] as LineThickness}
                  onShow={(v) => update(ln.showKey, v as DmiAdxConfig[typeof ln.showKey])}
                  onColor={(v) => update(ln.colorKey, v as DmiAdxConfig[typeof ln.colorKey])}
                  onWidth={(v) => update(ln.widthKey, v as DmiAdxConfig[typeof ln.widthKey])}
                />
              ))}
            </div>
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

/**
 * Fila de configuracion de una linea: checkbox de visibilidad, nombre, color
 * picker y selector de grosor. En movil se apila (flex-wrap) para legibilidad.
 */
function LineRow({
  name,
  show,
  color,
  width,
  onShow,
  onColor,
  onWidth,
}: {
  name: string;
  show: boolean;
  color: string;
  width: LineThickness;
  onShow: (v: boolean) => void;
  onColor: (v: string) => void;
  onWidth: (v: LineThickness) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-tv-border/60 px-2 py-1.5">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => onShow(e.target.checked)}
          className="h-3.5 w-3.5 accent-tv-blue"
          aria-label={`Mostrar ${name}`}
        />
        <span className="w-14 shrink-0 text-xs font-medium text-tv-text">{name}</span>
      </label>
      <input
        type="color"
        value={color}
        onChange={(e) => onColor(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-tv-border bg-tv-bg"
        aria-label={`Color ${name}`}
      />
      <Input
        type="text"
        value={color}
        onChange={(e) => onColor(e.target.value)}
        className="h-7 w-20 bg-tv-bg text-xs tabular-nums"
        aria-label={`Color hex ${name}`}
      />
      <select
        value={width}
        onChange={(e) => onWidth(e.target.value as LineThickness)}
        className="h-7 rounded border border-tv-border bg-tv-bg px-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
        aria-label={`Grosor ${name}`}
      >
        <option value="fino">Fino</option>
        <option value="medio">Medio</option>
        <option value="grueso">Grueso</option>
      </select>
    </div>
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
