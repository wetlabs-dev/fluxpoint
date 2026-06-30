export const POINTS_PER_INCH = 72;
export const LABEL_2_25_WIDTH_PT = 2.25 * POINTS_PER_INCH;
export const LABEL_1_25_HEIGHT_PT = 1.25 * POINTS_PER_INCH;
export const LETTER_WIDTH_PT = 8.5 * POINTS_PER_INCH;
export const LETTER_HEIGHT_PT = 11 * POINTS_PER_INCH;
export const BROTHER_DK_2210_WIDTH_PT = (1 + 1 / 7) * POINTS_PER_INCH;
export const QR_ONLY_SIZE_PT = 2 * POINTS_PER_INCH;

export const labelModes = ["FULL", "QR_ONLY"] as const;
export type LabelMode = (typeof labelModes)[number];

export const labelPrintFormats = [
  "ONE_PER_PAGE_2_25X1_25",
  "LEGACY_PRINT_SHEET",
  "BROTHER_DK_2210",
  "QR_ONLY_SQUARE"
] as const;
export type LabelPrintFormat = (typeof labelPrintFormats)[number];

export const labelOrientations = ["LANDSCAPE", "PORTRAIT"] as const;
export type LabelOrientation = (typeof labelOrientations)[number];

export const labelModeLabels: Record<LabelMode, string> = {
  FULL: "Full label",
  QR_ONLY: "QR-only"
};

export const labelPrintFormatLabels: Record<LabelPrintFormat, string> = {
  ONE_PER_PAGE_2_25X1_25: "2.25 x 1.25 inch label, one per page",
  LEGACY_PRINT_SHEET: "Legacy print sheet, ganged labels",
  BROTHER_DK_2210: "Brother DK-2210 continuous 1 1/7 inch label",
  QR_ONLY_SQUARE: "QR-only square label"
};

export const labelOrientationLabels: Record<LabelOrientation, string> = {
  LANDSCAPE: "Landscape",
  PORTRAIT: "Portrait"
};

export type LabelPrintOptions = {
  mode: LabelMode;
  format: LabelPrintFormat;
  orientation: LabelOrientation;
};

export function defaultLabelOrientation(format: LabelPrintFormat): LabelOrientation {
  if (format === "ONE_PER_PAGE_2_25X1_25" || format === "BROTHER_DK_2210") return "LANDSCAPE";
  return "PORTRAIT";
}

export function normalizeLabelMode(value: unknown, fallback: LabelMode = "FULL"): LabelMode {
  const normalized = String(value ?? "").trim().toUpperCase().replaceAll("-", "_");
  if (normalized === "QR" || normalized === "QR_ONLY") return "QR_ONLY";
  if (normalized === "FULL") return "FULL";
  return fallback;
}

export function normalizeLabelFormat(value: unknown, mode: LabelMode = "FULL"): LabelPrintFormat {
  if (mode === "QR_ONLY") return "QR_ONLY_SQUARE";
  const normalized = String(value ?? "").trim().toUpperCase().replaceAll("-", "_");
  if (normalized === "FIXED") return "ONE_PER_PAGE_2_25X1_25";
  if (normalized === "SHEET") return "LEGACY_PRINT_SHEET";
  if (normalized === "BROTHER_DK_2210") return "BROTHER_DK_2210";
  if (labelPrintFormats.includes(normalized as LabelPrintFormat) && normalized !== "QR_ONLY_SQUARE") return normalized as LabelPrintFormat;
  return "ONE_PER_PAGE_2_25X1_25";
}

export function normalizeLabelOrientation(value: unknown, format: LabelPrintFormat): LabelOrientation {
  if (format === "QR_ONLY_SQUARE") return "LANDSCAPE";
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "PORTRAIT" || normalized === "LANDSCAPE") return normalized;
  return defaultLabelOrientation(format);
}

export function normalizeLabelPrintOptions(input?: Partial<{ mode: unknown; format: unknown; orientation: unknown }>): LabelPrintOptions {
  const mode = normalizeLabelMode(input?.mode);
  const format = normalizeLabelFormat(input?.format, mode);
  return { mode, format, orientation: normalizeLabelOrientation(input?.orientation, format) };
}

export function orientSize(width: number, height: number, orientation: LabelOrientation): [number, number] {
  return orientation === "LANDSCAPE"
    ? [Math.max(width, height), Math.min(width, height)]
    : [Math.min(width, height), Math.max(width, height)];
}

export function baseLabelSize(format: LabelPrintFormat, orientation: LabelOrientation, brotherLength = 210): [number, number] {
  if (format === "QR_ONLY_SQUARE") return [QR_ONLY_SIZE_PT, QR_ONLY_SIZE_PT];
  if (format === "LEGACY_PRINT_SHEET") return orientSize(LETTER_WIDTH_PT, LETTER_HEIGHT_PT, orientation);
  if (format === "BROTHER_DK_2210") return orientation === "LANDSCAPE"
    ? [brotherLength, BROTHER_DK_2210_WIDTH_PT]
    : [BROTHER_DK_2210_WIDTH_PT, brotherLength];
  return orientSize(LABEL_2_25_WIDTH_PT, LABEL_1_25_HEIGHT_PT, orientation);
}

export function printableLabelSize(orientation: LabelOrientation): [number, number] {
  return orientSize(LABEL_2_25_WIDTH_PT, LABEL_1_25_HEIGHT_PT, orientation);
}
