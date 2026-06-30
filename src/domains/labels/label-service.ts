import { randomBytes } from "crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { LabelType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildLocationPath } from "@/lib/format/location";
import { ensureQrCode, normalizeScannableEntityType, type ScannableEntityType } from "@/domains/qr/qr-service";
import { writeAuditLog } from "@/domains/audit/audit-log";
import type { LabelEntityDetails } from "@/domains/labels/label-types";
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
  return QRCode.toBuffer(payload, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 512, color: { dark: "#062f35", light: "#ffffff" } });
}

function drawWrapped(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size: number, maxWidth: number, maxLines = 3) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else { if (line) lines.push(line); line = word; if (lines.length >= maxLines) break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((entry, index) => page.drawText(entry, { x, y: y - index * (size + 3), size, font, color: rgb(0.04, 0.18, 0.2) }));
}

async function renderIndividual(details: LabelEntityDetails, payload: string, labelType: LabelType) {
  const pdf = await PDFDocument.create();
  const simple = labelType === "SIMPLE_QR";
  const page = pdf.addPage(simple ? [144, 144] : [360, 180]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const image = await pdf.embedPng(await qrPng(payload));
  const qrSize = simple ? 108 : 130;
  page.drawImage(image, { x: 18, y: simple ? 18 : 25, width: qrSize, height: qrSize });
  if (!simple) {
    drawWrapped(page, bold, details.name, 165, 150, 19, 175, 2);
    page.drawText(safeText(details.category).toUpperCase(), { x: 165, y: 110, size: 9, font: bold, color: rgb(0.12, 0.55, 0.58) });
    drawWrapped(page, font, details.placement, 165, 93, 11, 175, 2);
    details.detailLines.slice(0, 4).forEach((line, index) => drawWrapped(page, font, line, 165, 70 - index * 14, 9, 175, 1));
  }
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

export async function generateLabel(input: { collectionId: string; userId: string; entityType: string; entityId: string; labelType: LabelType }) {
  const details = await resolveLabelEntity(input.collectionId, input.entityType, input.entityId);
  const sheet = input.labelType === "AQUARIUM_LIVESTOCK_SHEET";
  if (sheet && details.entityType !== "TANK") throw new Error("Livestock sheets require an aquarium.");
  if (input.labelType === "ENTITY_DETAIL" && !["INVENTORY", "SPECIES"].includes(details.entityType)) throw new Error("Detail labels require an inventory or species record.");
  if (input.labelType === "EQUIPMENT_DETAIL" && details.entityType !== "EQUIPMENT") throw new Error("Equipment labels require an equipment record.");
  if (input.labelType === "TANK_DETAIL" && details.entityType !== "TANK") throw new Error("Tank labels require an aquarium.");
  const qr = sheet ? null : await auditedQr({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, label: details.name, userId: input.userId });
  const rendered = sheet ? await renderTankSheet(input.collectionId, input.entityId, input.userId) : { bytes: await renderIndividual(details, qr!.payload, input.labelType), name: details.name };
  const filename = `${input.labelType.toLowerCase()}-${randomBytes(8).toString("hex")}.pdf`;
  const directory = path.join(labelsRoot(), input.collectionId);
  await mkdir(directory, { recursive: true });
  const absolutePath = path.join(directory, filename);
  await writeFile(absolutePath, rendered.bytes);
  const info = await stat(absolutePath);
  const record = await prisma.generatedLabel.create({ data: { collectionId: input.collectionId, qrCodeId: qr?.id ?? null, labelType: input.labelType, entityType: details.entityType, entityId: details.entityId, filename, storagePath: path.relative(process.cwd(), absolutePath), sizeBytes: info.size, createdById: input.userId } });
  await writeAuditLog({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, action: sheet ? "LIVESTOCK_SHEET_GENERATED" : "LABEL_GENERATED", after: { generatedLabelId: record.id, labelType: input.labelType, filename, sizeBytes: info.size }, createdById: input.userId });
  return record;
}

export type BulkLabelEntity = { entityType: ScannableEntityType; entityId: string };

export async function generateBulkLabels(input: { collectionId: string; userId: string; labelType: LabelType; entities: BulkLabelEntity[]; summary?: string }) {
  if (!input.entities.length) throw new Error("Select at least one record to label.");
  if (input.labelType === "AQUARIUM_LIVESTOCK_SHEET") throw new Error("Livestock sheets are generated from an individual aquarium.");
  const pdf = await PDFDocument.create();
  for (const entity of input.entities.slice(0, 120)) {
    const details = await resolveLabelEntity(input.collectionId, entity.entityType, entity.entityId);
    if (input.labelType === "EQUIPMENT_DETAIL" && details.entityType !== "EQUIPMENT") throw new Error("Equipment detail batches can only include equipment.");
    if (input.labelType === "TANK_DETAIL" && details.entityType !== "TANK") throw new Error("Tank detail batches can only include aquariums.");
    if (input.labelType === "ENTITY_DETAIL" && !["INVENTORY", "SPECIES"].includes(details.entityType)) throw new Error("Detail label batches can only include inventory or species records.");
    const qr = await auditedQr({ collectionId: input.collectionId, entityType: details.entityType, entityId: details.entityId, label: details.name, userId: input.userId });
    const single = await PDFDocument.load(await renderIndividual(details, qr.payload, input.labelType));
    const pages = await pdf.copyPages(single, single.getPageIndices());
    pages.forEach((page) => pdf.addPage(page));
  }
  const filename = `bulk-${input.labelType.toLowerCase()}-${randomBytes(8).toString("hex")}.pdf`;
  const directory = path.join(labelsRoot(), input.collectionId);
  await mkdir(directory, { recursive: true });
  const absolutePath = path.join(directory, filename);
  const bytes = await pdf.save();
  await writeFile(absolutePath, bytes);
  const info = await stat(absolutePath);
  const record = await prisma.generatedLabel.create({ data: { collectionId: input.collectionId, qrCodeId: null, labelType: input.labelType, entityType: "BULK_LABEL_BATCH", entityId: input.collectionId, filename, storagePath: path.relative(process.cwd(), absolutePath), sizeBytes: info.size, createdById: input.userId } });
  await writeAuditLog({ collectionId: input.collectionId, entityType: "GeneratedLabel", entityId: record.id, action: "BULK_LABEL_BATCH_GENERATED", after: { generatedLabelId: record.id, labelType: input.labelType, filename, sizeBytes: info.size, selectedCount: input.entities.length, summary: input.summary ?? null }, createdById: input.userId });
  return record;
}

export function labelAbsolutePath(storagePath: string) {
  const root = path.resolve(labelsRoot());
  const resolved = path.resolve(process.cwd(), storagePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Label path escaped the label root.");
  return resolved;
}

export async function readGeneratedLabel(storagePath: string) { return readFile(labelAbsolutePath(storagePath)); }
export async function deleteGeneratedLabelFile(storagePath: string) { await unlink(labelAbsolutePath(storagePath)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
