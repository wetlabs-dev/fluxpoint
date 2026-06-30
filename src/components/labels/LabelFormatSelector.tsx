"use client";

import { useState } from "react";
import { Select } from "@/components/ui/input";
import {
  defaultLabelOrientation,
  labelModeLabels,
  labelOrientationLabels,
  labelPrintFormatLabels,
  normalizeLabelOrientation,
  type LabelMode,
  type LabelOrientation,
  type LabelPrintFormat
} from "@/domains/labels/label-formats";

const fullFormats: LabelPrintFormat[] = ["ONE_PER_PAGE_2_25X1_25", "LEGACY_PRINT_SHEET", "BROTHER_DK_2210"];
const orientations: LabelOrientation[] = ["LANDSCAPE", "PORTRAIT"];

export function LabelFormatSelector({
  initialMode = "FULL",
  initialFormat = "ONE_PER_PAGE_2_25X1_25",
  initialOrientation,
  onChange
}: {
  initialMode?: LabelMode;
  initialFormat?: LabelPrintFormat;
  initialOrientation?: LabelOrientation;
  onChange?: (value: { mode: LabelMode; format: LabelPrintFormat; orientation: LabelOrientation }) => void;
}) {
  const [mode, setMode] = useState<LabelMode>(initialMode);
  const [format, setFormat] = useState<LabelPrintFormat>(initialMode === "QR_ONLY" ? "QR_ONLY_SQUARE" : initialFormat);
  const [orientation, setOrientation] = useState<LabelOrientation>(initialOrientation ?? defaultLabelOrientation(initialFormat));

  function emit(next: { mode?: LabelMode; format?: LabelPrintFormat; orientation?: LabelOrientation }) {
    const nextMode = next.mode ?? mode;
    const nextFormat = nextMode === "QR_ONLY" ? "QR_ONLY_SQUARE" : next.format ?? format;
    const nextOrientation = nextMode === "QR_ONLY" ? "LANDSCAPE" : normalizeLabelOrientation(next.orientation ?? orientation, nextFormat);
    onChange?.({ mode: nextMode, format: nextFormat, orientation: nextOrientation });
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="grid gap-1 text-sm font-medium">
        <span>Label type</span>
        <Select
          value={mode}
          onChange={(event) => {
            const nextMode = event.target.value as LabelMode;
            const nextFormat = nextMode === "QR_ONLY" ? "QR_ONLY_SQUARE" : format === "QR_ONLY_SQUARE" ? "ONE_PER_PAGE_2_25X1_25" : format;
            const nextOrientation = nextMode === "QR_ONLY" ? "LANDSCAPE" : defaultLabelOrientation(nextFormat);
            setMode(nextMode); setFormat(nextFormat); setOrientation(nextOrientation); emit({ mode: nextMode, format: nextFormat, orientation: nextOrientation });
          }}
        >
          <option value="FULL">{labelModeLabels.FULL}</option>
          <option value="QR_ONLY">{labelModeLabels.QR_ONLY}</option>
        </Select>
        <input type="hidden" name="labelMode" value={mode} />
      </label>
      <label className="grid gap-1 text-sm font-medium md:col-span-1">
        <span>Print format</span>
        {mode === "QR_ONLY" ? (
          <>
            <Select value="QR_ONLY_SQUARE" disabled><option>{labelPrintFormatLabels.QR_ONLY_SQUARE}</option></Select>
            <input type="hidden" name="printFormat" value="QR_ONLY_SQUARE" />
          </>
        ) : (
          <Select
            name="printFormat"
            value={format}
            onChange={(event) => {
              const nextFormat = event.target.value as LabelPrintFormat;
              const nextOrientation = defaultLabelOrientation(nextFormat);
              setFormat(nextFormat); setOrientation(nextOrientation); emit({ format: nextFormat, orientation: nextOrientation });
            }}
          >
            {fullFormats.map((value) => <option key={value} value={value}>{labelPrintFormatLabels[value]}</option>)}
          </Select>
        )}
      </label>
      {mode === "QR_ONLY" ? (
        <div className="rounded-md border border-border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
          QR-only labels are square and print only the scannable web URL.
          <input type="hidden" name="orientation" value="LANDSCAPE" />
        </div>
      ) : (
        <label className="grid gap-1 text-sm font-medium">
          <span>Orientation</span>
          <Select name="orientation" value={orientation} onChange={(event) => { const next = event.target.value as LabelOrientation; setOrientation(next); emit({ orientation: next }); }}>
            {orientations.map((value) => <option key={value} value={value}>{labelOrientationLabels[value]}</option>)}
          </Select>
        </label>
      )}
    </div>
  );
}
