import { randomBytes } from "crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib";
import type { LabelType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildLocationPath } from "@/lib/format/location";
import { ensureQrCode, normalizeScannableEntityType, type ScannableEntityType } from "@/domains/qr/qr-service";
import { writeAuditLog } from "@/domains/audit/audit-log";
import type { LabelEntityDetails } from "@/domains/labels/label-types";
import {
  LABEL_2_25_WIDTH_PT,
  LABEL_1_25_HEIGHT_PT,
  QR_ONLY_SIZE_PT,
  baseLabelSize,
  normalizeLabelPrintOptions,
  printableLabelSize,
  type LabelOrientation,
  type LabelPrintOptions
} from "@/domains/labels/label-formats";
import { habitatsForSalinity } from "@/domains/species/habitat";
import { stockingPressureFlagLabels, stockingPressureLevelLabels, type StockingPressureFlag } from "@/domains/aquariums/stocking-pressure-flags";

const labelsRoot = () => path.join(process.cwd(), "public", "labels");
const safeText = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim();

function placement(item: any) {
  return item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? item.quarantineProject?.name ?? item.status.replaceAll("_", " ").toLowerCase();
}

function exceptionalStatus(status: string) {
  return ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"].includes(status) ? status.toLowerCase().replaceAll("_", " ") : null;
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.map((line) => safeText(line)).filter(Boolean).slice(0, 4);
}

export async function resolveLabelEntity(collectionId: string, rawEntityType: string, entityId: string): Promise<LabelEntityDetails> {
  const entityType = normalizeScannableEntityType(rawEntityType);
  if (entityType === "TANK") {
    const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: entityId, collectionId }, include: { structuredLocation: { include: { parent: { include: { parent: true } } } } } });
    return { entityType, entityId, name: aquarium.generatedName ?? aquarium.name, category: `${habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt).join(" / ").toLowerCase()} ${aquarium.aquariumType.toLowerCase().replaceAll("_", " ")}`, placement: aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location ?? "No location", detailLines: compactLines([`${aquarium.volumeGallons ?? "?"} ${aquarium.volumeUnit === "LITER" ? "L" : "gal"}`, aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location, exceptionalStatus(aquarium.status)]) };
  }
  if (entityType === "SPECIES") {
    const species = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: entityId, OR: [{ collectionId }, { collectionId: null }] } });
    return { entityType, entityId, name: species.commonName, scientificName: species.scientificName, category: species.category.toLowerCase(), placement: "Species definition", detailLines: [species.careNotes ?? species.notes ?? "Fluxpoint species record"] };
  }
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: entityId, collectionId, ...(entityType === "EQUIPMENT" ? { itemType: "EQUIPMENT" } : {}) }, include: { aquarium: true, storageLocation: true, quarantineProject: true, speciesDefinition: true, equipmentProfile: true } });
  const profile = item.equipmentProfile;
  const brandModel = [profile?.brand, profile?.model].filter(Boolean).join(" ");
  return {
    entityType,
    entityId,
    name: item.speciesDefinition?.commonName && ["FISH", "INVERT", "PLANT"].includes(item.itemType) ? item.speciesDefinition.commonName : item.name,
    scientificName: item.speciesDefinition?.scientificName,
    category: profile?.equipmentType?.toLowerCase().replaceAll("_", " ") ?? item.itemType.toLowerCase(),
    placement: placement(item),
    detailLines: entityType === "EQUIPMENT"
      ? compactLines([profile?.equipmentType?.replaceAll("_", " "), placement(item), brandModel, profile?.maintenanceIntervalDays ? `Clean every ${profile.maintenanceIntervalDays} days` : null, exceptionalStatus(item.status)])
      : compactLines([item.speciesDefinition?.scientificName, `${item.quantity} ${item.unit ?? "units"}`, placement(item), exceptionalStatus(item.status), item.description])
  };
}

async function auditedQr(input: { collectionId: string; entityType: ScannableEntityType; entityId: string; label: string; userId: string }) {
  const existing = await prisma.qrCode.findUnique({ where: { entityType_entityId: { entityType: input.entityType, entityId: input.entityId } } });
  const qr = await ensureQrCode(input);
  if (!existing) await writeAuditLog({ collectionId: input.collectionId, entityType: input.entityType, entityId: input.entityId, action: "QR_PUBLIC_CODE_CREATED", after: { qrCodeId: qr.id, publicCode: qr.publicCode }, createdById: input.userId });
  return qr;
}

async function qrPng(payload: string) {
  return QRCode.toBuffer(payload, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 512, color: { dark: "#000000", light: "#ffffff" } });
}

function fitFontSize(font: PDFFont, value: string, max: number, min: number, maxWidth: number) {
  const text = safeText(value);
  for (let size = max; size >= min; size -= 0.5) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return size;
  }
  return min;
}

function wrapLines(font: PDFFont, value: string, size: number, maxWidth: number, maxLines = 3) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else { if (line) lines.push(line); line = word; if (lines.length >= maxLines) break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawWrapped(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size: number, maxWidth: number, maxLines = 3, lineHeight = size + 3) {
  wrapLines(font, value, size, maxWidth, maxLines).forEach((entry, index) => page.drawText(entry, { x, y: y - index * lineHeight, size, font, color: rgb(0, 0, 0) }));
}

function fullLabelMeta(details: LabelEntityDetails) {
  return [
    safeText(details.category).toUpperCase(),
    safeText(details.placement),
    ...details.detailLines.map(safeText)
  ].filter(Boolean).filter((line, index, array) => array.indexOf(line) === index).slice(0, 5);
}

function drawQrOnlyLabel(page: PDFPage, image: PDFImage) {
  const quiet = 12;
  const qrSize = QR_ONLY_SIZE_PT - quiet * 2;
  page.drawImage(image, { x: quiet, y: quiet, width: qrSize, height: qrSize });
}

function drawFullLabel(page: PDFPage, fonts: { font: PDFFont; bold: PDFFont }, image: PDFImage, details: LabelEntityDetails, x: number, y: number, width: number, height: number, orientation: LabelOrientation) {
  const margin = Math.max(4, Math.min(8, Math.min(width, height) * 0.06));
  page.drawRectangle({ x, y, width, height, borderWidth: 0.6, borderColor: rgb(0, 0, 0), color: rgb(1, 1, 1) });

  if (orientation === "PORTRAIT") {
    const qrSize = Math.min(width - margin * 2, height * 0.43);
    const qrX = x + (width - qrSize) / 2;
    const qrY = y + height - margin - qrSize;
    page.drawImage(image, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    const textX = x + margin;
    const textWidth = width - margin * 2;
    const titleTop = qrY - 7;
    const titleSize = fitFontSize(fonts.bold, details.name, 13, 6.5, textWidth);
    drawWrapped(page, fonts.bold, details.name, textX, titleTop, titleSize, textWidth, 2, titleSize + 2);
    const titleLines = wrapLines(fonts.bold, details.name, titleSize, textWidth, 2).length || 1;
    let cursor = titleTop - titleLines * (titleSize + 2) - 5;
    const category = safeText(details.category).toUpperCase();
    const categorySize = fitFontSize(fonts.bold, category, 7, 4.5, textWidth);
    page.drawText(category, { x: textX, y: cursor, size: categorySize, font: fonts.bold, color: rgb(0, 0, 0) });
    cursor -= categorySize + 5;
    fullLabelMeta(details).filter((line) => line !== category).slice(0, 3).forEach((line) => {
      drawWrapped(page, fonts.font, line, textX, cursor, 6.3, textWidth, 1, 7.4);
      cursor -= 8.2;
    });
    return;
  }

  const qrSize = Math.min(height - margin * 2, width * 0.43);
  const qrX = x + margin;
  const qrY = y + (height - qrSize) / 2;
  page.drawImage(image, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  const textX = qrX + qrSize + margin + 2;
  const textWidth = width - textX + x - margin;
  const titleSize = fitFontSize(fonts.bold, details.name, 18, 8, textWidth);
  const titleLines = wrapLines(fonts.bold, details.name, titleSize, textWidth, 2);
  const titleHeight = titleLines.length * (titleSize + 1.5);
  let cursor = y + height - margin - titleSize;
  titleLines.forEach((line, index) => page.drawText(line, { x: textX, y: cursor - index * (titleSize + 1.5), size: titleSize, font: fonts.bold, color: rgb(0, 0, 0) }));
  cursor -= titleHeight + 5;
  const category = safeText(details.category).toUpperCase();
  const categorySize = fitFontSize(fonts.bold, category, 8.5, 5, textWidth);
  page.drawText(category, { x: textX, y: cursor, size: categorySize, font: fonts.bold, color: rgb(0, 0, 0) });
  cursor -= categorySize + 5;
  fullLabelMeta(details).filter((line) => line !== category).slice(0, 3).forEach((line, index) => {
    const size = index === 0 ? 9 : 7.2;
    drawWrapped(page, fonts.font, line, textX, cursor, size, textWidth, 1, size + 2);
    cursor -= size + 4;
  });
}

function brotherLength(details: LabelEntityDetails, orientation: LabelOrientation) {
  if (orientation === "LANDSCAPE") {
    const longest = Math.max(safeText(details.name).length, safeText(details.placement).length, safeText(details.category).length, ...details.detailLines.map((line) => safeText(line).length));
    return Math.max(210, Math.min(360, 128 + longest * 3.2));
  }
  return Math.max(190, Math.min(330, 170 + Math.max(0, safeText(details.name).length - 12) * 2.6 + fullLabelMeta(details).length * 8));
}

async function setupLabelPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { pdf, font, bold };
}

async function renderIndividual(details: LabelEntityDetails, payload: string, labelType: LabelType, rawOptions?: Partial<LabelPrintOptions>) {
  const options = normalizeLabelPrintOptions({ ...rawOptions, mode: labelType === "SIMPLE_QR" ? "QR_ONLY" : rawOptions?.mode });
  const { pdf, font, bold } = await setupLabelPdf();
  const image = await pdf.embedPng(await qrPng(payload));
  if (options.mode === "QR_ONLY" || labelType === "SIMPLE_QR") {
    const page = pdf.addPage([QR_ONLY_SIZE_PT, QR_ONLY_SIZE_PT]);
    drawQrOnlyLabel(page, image);
    return pdf.save();
  }
  const length = options.format === "BROTHER_DK_2210" ? brotherLength(details, options.orientation) : undefined;
  const [width, height] = baseLabelSize(options.format, options.orientation, length);
  const page = pdf.addPage([width, height]);
  drawFullLabel(page, { font, bold }, image, details, 0, 0, width, height, options.orientation);
  return pdf.save();
}

async function renderTankSheet(collectionId: string, aquariumId: string, userId: string) {
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId }, include: { stockingPressureEstimates: { orderBy: { createdAt: "desc" }, take: 1 }, items: { where: { status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"] }, itemType: { in: ["FISH", "INVERT", "PLANT", "BOTANICAL", "OTHER"] } }, include: { speciesDefinition: { include: { aliases: true } } }, orderBy: [{ itemType: "asc" }, { name: "asc" }] } } });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 748;
  const title = aquarium.generatedName ?? aquarium.name;
  const estimate = aquarium.stockingPressureEstimates[0];
  const estimateFlags = Array.isArray(estimate?.flags) ? estimate.flags.filter((flag): flag is StockingPressureFlag => typeof flag === "string" && flag in stockingPressureFlagLabels).slice(0, 4) : [];
  const header = () => {
    page.drawText(safeText(title), { x: 40, y, size: 24, font: bold, color: rgb(0.04, 0.18, 0.2) }); y -= 24;
    page.drawText(`${habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt).join(" / ").toLowerCase()} ${aquarium.aquariumType.toLowerCase().replaceAll("_", " ")} - ${aquarium.targetSalinityMinPpt ?? "?"}-${aquarium.targetSalinityMaxPpt ?? "?"} ppt - ${aquarium.volumeGallons ?? "?"} ${aquarium.volumeUnit === "LITER" ? "L" : "gal"} - generated ${new Date().toISOString().slice(0, 10)}`, { x: 40, y, size: 9, font, color: rgb(0.25, 0.42, 0.44) }); y -= 18;
    if (estimate) {
      page.drawText(`Stocking Pressure: ${stockingPressureLevelLabels[estimate.level]} (${estimate.confidence.toLowerCase()} confidence)`, { x: 40, y, size: 10, font: bold, color: rgb(0.12, 0.55, 0.58) }); y -= 14;
      if (estimateFlags.length) { drawWrapped(page, font, estimateFlags.map((flag) => stockingPressureFlagLabels[flag]).join(" - "), 40, y, 8, 532, 1); y -= 13; }
    }
    y -= 10;
  };
  header();
  const sheetCategory = (item: typeof aquarium.items[number]) => item.speciesDefinition?.category === "CORAL" ? "Corals" : item.itemType === "INVERT" ? "Invertebrates" : item.itemType === "PLANT" ? "Plants" : item.itemType === "FISH" ? "Fish" : "Other";
  const categoryOrder = ["Fish", "Invertebrates", "Plants", "Corals", "Other"];
  const sheetItems = [...aquarium.items].sort((a, b) => categoryOrder.indexOf(sheetCategory(a)) - categoryOrder.indexOf(sheetCategory(b)) || a.name.localeCompare(b.name));
  let category = "";
  for (const item of sheetItems) {
    const nextCategory = sheetCategory(item);
    const needsHeading = nextCategory !== category;
    if (y < 100) { page = pdf.addPage([612, 792]); y = 748; header(); category = ""; }
    if (needsHeading) { category = nextCategory; page.drawText(category, { x: 40, y, size: 14, font: bold, color: rgb(0.12, 0.55, 0.58) }); y -= 20; }
    const qr = await auditedQr({ collectionId, entityType: "INVENTORY", entityId: item.id, label: item.name, userId });
    const image = await pdf.embedPng(await qrPng(qr.payload));
    page.drawRectangle({ x: 40, y: y - 66, width: 532, height: 72, borderWidth: 0.5, borderColor: rgb(0.75, 0.84, 0.84), color: rgb(0.98, 0.99, 0.99) });
    page.drawImage(image, { x: 46, y: y - 60, width: 58, height: 58 });
    drawWrapped(page, bold, item.name, 116, y - 10, 12, 300, 1);
    drawWrapped(page, font, item.speciesDefinition?.scientificName ?? item.speciesDefinition?.commonName ?? item.itemType.toLowerCase(), 116, y - 28, 9, 300, 1);
    const alias = item.speciesDefinition?.aliases[0]?.alias;
    drawWrapped(page, font, [`${item.quantity} ${item.unit ?? "units"}`, item.status.toLowerCase().replaceAll("_", " "), alias].filter(Boolean).join(" - "), 116, y - 46, 9, 360, 1);
    y -= 82;
  }
  if (!aquarium.items.length) page.drawText("No current inhabitants or plants are recorded.", { x: 40, y, size: 11, font });
  return { bytes: await pdf.save(), name: title };
}

export async function generateLabel(input: { collectionId: string; userId: string; entityType: string; entityId: string; labelType: LabelType; printOptions?: Partial<LabelPrintOptions> }) {
  const details = await resolveLabelEntity(input.collectionId, input.entityType, input.entityId);
  const sheet = input.labelType === "AQUARIUM_LIVESTOCK_SHEET";
  if (sheet && details.entityType !== "TANK") throw new Error("Livestock sheets require an aquarium.");
  if (input.labelType === "ENTITY_DETAIL" && !["INVENTORY", "SPECIES"].includes(details.entityType)) throw new Error("Detail labels require an inventory or species record.");
  if (input.labelType === "EQUIPMENT_DETAIL" && details.entityType !== "EQUIPMENT") throw new Error("Equipment labels require an equipment record.");
  if (input.labelType === "TANK_DETAIL" && details.entityType !== "TANK") throw new Error("Tank labels require an aquarium.");
  const qr = sheet ? null : await auditedQr({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, label: details.name, userId: input.userId });
  const rendered = sheet ? await renderTankSheet(input.collectionId, input.entityId, input.userId) : { bytes: await renderIndividual(details, qr!.payload, input.labelType, input.printOptions), name: details.name };
  const filename = `${input.labelType.toLowerCase()}-${randomBytes(8).toString("hex")}.pdf`;
  const directory = path.join(labelsRoot(), input.collectionId);
  await mkdir(directory, { recursive: true });
  const absolutePath = path.join(directory, filename);
  await writeFile(absolutePath, rendered.bytes);
  const info = await stat(absolutePath);
  const record = await prisma.generatedLabel.create({ data: { collectionId: input.collectionId, qrCodeId: qr?.id ?? null, labelType: input.labelType, entityType: details.entityType, entityId: details.entityId, filename, storagePath: path.relative(process.cwd(), absolutePath), sizeBytes: info.size, createdById: input.userId } });
  await writeAuditLog({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, action: sheet ? "LIVESTOCK_SHEET_GENERATED" : "LABEL_GENERATED", after: { generatedLabelId: record.id, labelType: input.labelType, filename, sizeBytes: info.size, printOptions: sheet ? null : normalizeLabelPrintOptions({ ...input.printOptions, mode: input.labelType === "SIMPLE_QR" ? "QR_ONLY" : input.printOptions?.mode }) }, createdById: input.userId });
  return record;
}

export type BulkLabelEntity = { entityType: ScannableEntityType; entityId: string };

function sheetGrid(pageWidth: number, pageHeight: number, labelWidth: number, labelHeight: number) {
  const marginX = 36;
  const marginY = 36;
  const gutterX = 18;
  const gutterY = 8;
  const usableWidth = pageWidth - marginX * 2;
  const usableHeight = pageHeight - marginY * 2;
  const columns = Math.max(1, Math.floor((usableWidth + gutterX) / (labelWidth + gutterX)));
  const rows = Math.max(1, Math.floor((usableHeight + gutterY) / (labelHeight + gutterY)));
  return {
    columns,
    rows,
    perPage: columns * rows,
    offsetX: marginX + Math.max(0, (usableWidth - columns * labelWidth - (columns - 1) * gutterX) / 2),
    offsetY: marginY + Math.max(0, (usableHeight - rows * labelHeight - (rows - 1) * gutterY) / 2),
    gutterX,
    gutterY
  };
}

export async function generateBulkLabels(input: { collectionId: string; userId: string; labelType: LabelType; entities: BulkLabelEntity[]; summary?: string; printOptions?: Partial<LabelPrintOptions> }) {
  if (!input.entities.length) throw new Error("Select at least one record to label.");
  if (input.labelType === "AQUARIUM_LIVESTOCK_SHEET") throw new Error("Livestock sheets are generated from an individual aquarium.");
  const options = normalizeLabelPrintOptions({ ...input.printOptions, mode: input.labelType === "SIMPLE_QR" ? "QR_ONLY" : input.printOptions?.mode });
  const { pdf, font, bold } = await setupLabelPdf();
  const selected = input.entities.slice(0, 120);
  const fonts = { font, bold };
  if (options.format === "LEGACY_PRINT_SHEET" && options.mode !== "QR_ONLY" && input.labelType !== "SIMPLE_QR") {
    const [pageWidth, pageHeight] = baseLabelSize("LEGACY_PRINT_SHEET", options.orientation);
    const [labelWidth, labelHeight] = printableLabelSize(options.orientation);
    const grid = sheetGrid(pageWidth, pageHeight, labelWidth, labelHeight);
    let page = pdf.addPage([pageWidth, pageHeight]);
    for (let index = 0; index < selected.length; index += 1) {
      if (index > 0 && index % grid.perPage === 0) page = pdf.addPage([pageWidth, pageHeight]);
      const entity = selected[index];
      const details = await resolveAndValidateBulkLabel(input.collectionId, entity, input.labelType);
      const qr = await auditedQr({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, label: details.name, userId: input.userId });
      const image = await pdf.embedPng(await qrPng(qr.payload));
      const position = index % grid.perPage;
      const column = position % grid.columns;
      const row = Math.floor(position / grid.columns);
      const x = grid.offsetX + column * (labelWidth + grid.gutterX);
      const y = pageHeight - grid.offsetY - (row + 1) * labelHeight - row * grid.gutterY;
      drawFullLabel(page, fonts, image, details, x, y, labelWidth, labelHeight, options.orientation);
    }
  } else {
    for (const entity of selected) {
      const details = await resolveAndValidateBulkLabel(input.collectionId, entity, input.labelType);
      const qr = await auditedQr({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, label: details.name, userId: input.userId });
      const image = await pdf.embedPng(await qrPng(qr.payload));
      if (options.mode === "QR_ONLY" || input.labelType === "SIMPLE_QR") {
        const page = pdf.addPage([QR_ONLY_SIZE_PT, QR_ONLY_SIZE_PT]);
        drawQrOnlyLabel(page, image);
      } else {
        const length = options.format === "BROTHER_DK_2210" ? brotherLength(details, options.orientation) : undefined;
        const [width, height] = baseLabelSize(options.format, options.orientation, length);
        const page = pdf.addPage([width, height]);
        drawFullLabel(page, fonts, image, details, 0, 0, width, height, options.orientation);
      }
    }
  }
  if (!pdf.getPageCount()) {
    const page = pdf.addPage([LABEL_2_25_WIDTH_PT, LABEL_1_25_HEIGHT_PT]);
    page.drawText("No labels selected.", { x: 18, y: 40, size: 10, font, color: rgb(0, 0, 0) });
  }
  const filename = `bulk-${input.labelType.toLowerCase()}-${options.format.toLowerCase()}-${randomBytes(8).toString("hex")}.pdf`;
  const directory = path.join(labelsRoot(), input.collectionId);
  await mkdir(directory, { recursive: true });
  const absolutePath = path.join(directory, filename);
  const bytes = await pdf.save();
  await writeFile(absolutePath, bytes);
  const info = await stat(absolutePath);
  const record = await prisma.generatedLabel.create({ data: { collectionId: input.collectionId, qrCodeId: null, labelType: input.labelType, entityType: "BULK_LABEL_BATCH", entityId: input.collectionId, filename, storagePath: path.relative(process.cwd(), absolutePath), sizeBytes: info.size, createdById: input.userId } });
  await writeAuditLog({ collectionId: input.collectionId, entityType: "GeneratedLabel", entityId: record.id, action: "BULK_LABEL_BATCH_GENERATED", after: { generatedLabelId: record.id, labelType: input.labelType, filename, sizeBytes: info.size, selectedCount: input.entities.length, summary: input.summary ?? null, printOptions: options }, createdById: input.userId });
  return record;
}

async function resolveAndValidateBulkLabel(collectionId: string, entity: BulkLabelEntity, labelType: LabelType) {
  const details = await resolveLabelEntity(collectionId, entity.entityType, entity.entityId);
  if (labelType === "EQUIPMENT_DETAIL" && details.entityType !== "EQUIPMENT") throw new Error("Equipment detail batches can only include equipment.");
  if (labelType === "TANK_DETAIL" && details.entityType !== "TANK") throw new Error("Tank detail batches can only include aquariums.");
  if (labelType === "ENTITY_DETAIL" && !["INVENTORY", "SPECIES"].includes(details.entityType)) throw new Error("Detail label batches can only include inventory or species records.");
  return details;
}

export function labelAbsolutePath(storagePath: string) {
  const root = path.resolve(labelsRoot());
  const resolved = path.resolve(process.cwd(), storagePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Label path escaped the label root.");
  return resolved;
}

export async function readGeneratedLabel(storagePath: string) { return readFile(labelAbsolutePath(storagePath)); }
export async function deleteGeneratedLabelFile(storagePath: string) { await unlink(labelAbsolutePath(storagePath)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
