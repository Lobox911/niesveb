import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

/**
 * The badge worn at the venue.
 *
 * CR80 portrait — 54 by 85.6mm, the size of a bank card turned on its end,
 * which is what every lanyard holder and badge printer in the country takes.
 * Printed at home on A4 it still cuts out cleanly because crop marks are
 * drawn around it.
 *
 * The QR encodes the passcode, so the attendance desk scans the badge instead
 * of typing eight characters per person with a queue waiting.
 */

const MM = 2.83465;
const CARD_W = 54 * MM;    // 153.07pt
const CARD_H = 85.6 * MM;  // 242.65pt

export type PhotoCardInput = {
  name: string;
  category: string;
  membershipNo: string;
  passcode: string;
  mode: string;

  eventTitle: string;
  eventDate: string;
  branchName: string;

  primaryHex: string;
  accentHex: string;

  photo?: Uint8Array | null;
  photoType?: "png" | "jpg" | null;
  crest?: Uint8Array | null;
  crestType?: "png" | "jpg" | null;

  /** A4 sheet with crop marks, rather than a bare card. */
  forPrinting?: boolean;
};

function hex(h: string, fallback: [number, number, number]) {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return rgb(fallback[0] / 255, fallback[1] / 255, fallback[2] / 255);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function embed(
  doc: PDFDocument,
  bytes: Uint8Array | null | undefined,
  type: "png" | "jpg" | null | undefined,
) {
  if (!bytes || bytes.length === 0) return null;
  try {
    if (type === "jpg") {
      try { return await doc.embedJpg(bytes); } catch { return await doc.embedPng(bytes); }
    }
    try { return await doc.embedPng(bytes); } catch { return await doc.embedJpg(bytes); }
  } catch {
    return null;
  }
}

/** Shrink to fit on one line; a wrapped name on a badge this size is unreadable. */
function fitted(font: PDFFont, text: string, max: number, min: number, width: number) {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > width) size -= 0.5;
  return size;
}

/**
 * Surname first, given names after.
 *
 * A badge is read at arm's length in a crowded room. The surname is what
 * someone is looking for on a delegate list, so it leads and it is the line
 * set largest.
 */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { lead: full.trim(), rest: "" };
  return { lead: parts[parts.length - 1], rest: parts.slice(0, -1).join(" ") };
}

async function drawCard(
  doc: PDFDocument, page: PDFPage, x: number, y: number, input: PhotoCardInput,
) {
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const primary = hex(input.primaryHex, [11, 110, 79]);
  const accent = hex(input.accentHex, [176, 138, 46]);
  const ink = rgb(0.06, 0.12, 0.18);
  const muted = rgb(0.42, 0.46, 0.44);

  page.drawRectangle({ x, y, width: CARD_W, height: CARD_H, color: rgb(1, 1, 1) });
  page.drawRectangle({
    x, y, width: CARD_W, height: CARD_H,
    borderColor: rgb(0.85, 0.87, 0.85), borderWidth: 0.5,
  });

  /* ---- header band ---- */

  const bandH = 40;
  page.drawRectangle({ x, y: y + CARD_H - bandH, width: CARD_W, height: bandH, color: primary });

  const crest = await embed(doc, input.crest, input.crestType);
  if (crest) {
    const h = 20;
    const w = (crest.width / crest.height) * h;
    page.drawImage(crest, { x: x + 8, y: y + CARD_H - bandH + 10, width: w, height: h });
  }

  const branchSize = fitted(sansBold, input.branchName, 7, 4.5, CARD_W - (crest ? 40 : 16));
  page.drawText(input.branchName, {
    x: x + (crest ? 34 : 8),
    y: y + CARD_H - bandH + 22,
    size: branchSize, font: sansBold, color: rgb(1, 1, 1),
  });

  const dateSize = fitted(sans, input.eventDate, 6, 4, CARD_W - (crest ? 40 : 16));
  page.drawText(input.eventDate, {
    x: x + (crest ? 34 : 8),
    y: y + CARD_H - bandH + 12,
    size: dateSize, font: sans, color: rgb(1, 1, 1),
  });

  /* ---- photograph ---- */

  const photoSize = 74;
  const photoX = x + (CARD_W - photoSize) / 2;
  const photoY = y + CARD_H - bandH - photoSize - 10;

  const photo = await embed(doc, input.photo, input.photoType);
  if (photo) {
    page.drawImage(photo, { x: photoX, y: photoY, width: photoSize, height: photoSize });
  } else {
    // No photograph is a usable badge, not a broken one — some people will
    // print at the desk without one.
    page.drawRectangle({
      x: photoX, y: photoY, width: photoSize, height: photoSize,
      color: rgb(0.96, 0.97, 0.96),
    });
    const t = "PHOTO";
    page.drawText(t, {
      x: photoX + (photoSize - sans.widthOfTextAtSize(t, 7)) / 2,
      y: photoY + photoSize / 2 - 3,
      size: 7, font: sans, color: muted,
    });
  }
  page.drawRectangle({
    x: photoX, y: photoY, width: photoSize, height: photoSize,
    borderColor: rgb(0.85, 0.87, 0.85), borderWidth: 0.5,
  });

  /* ---- name ---- */

  const { lead, rest } = splitName(input.name);
  let cursor = photoY - 16;

  const leadSize = fitted(sansBold, lead.toUpperCase(), 13, 7, CARD_W - 12);
  page.drawText(lead.toUpperCase(), {
    x: x + (CARD_W - sansBold.widthOfTextAtSize(lead.toUpperCase(), leadSize)) / 2,
    y: cursor, size: leadSize, font: sansBold, color: ink,
  });
  cursor -= 12;

  if (rest) {
    const restSize = fitted(sans, rest, 9, 5.5, CARD_W - 12);
    page.drawText(rest, {
      x: x + (CARD_W - sans.widthOfTextAtSize(rest, restSize)) / 2,
      y: cursor, size: restSize, font: sans, color: muted,
    });
    cursor -= 12;
  }

  /* ---- category ---- */

  const catSize = fitted(sansBold, input.category.toUpperCase(), 6.5, 4.5, CARD_W - 20);
  const catW = sansBold.widthOfTextAtSize(input.category.toUpperCase(), catSize) + 12;
  page.drawRectangle({
    x: x + (CARD_W - catW) / 2, y: cursor - 4, width: catW, height: 13,
    color: accent,
  });
  page.drawText(input.category.toUpperCase(), {
    x: x + (CARD_W - catW) / 2 + 6, y: cursor, size: catSize, font: sansBold, color: rgb(1, 1, 1),
  });
  cursor -= 16;

  if (input.mode === "virtual") {
    const label = "VIRTUAL PARTICIPANT";
    const s = 5.5;
    page.drawText(label, {
      x: x + (CARD_W - sans.widthOfTextAtSize(label, s)) / 2,
      y: cursor, size: s, font: sans, color: muted,
    });
    cursor -= 10;
  }

  /* ---- QR and passcode ---- */

  try {
    const png = await QRCode.toDataURL(input.passcode, {
      margin: 0, width: 200, errorCorrectionLevel: "M",
      color: { dark: "#101E2E", light: "#FFFFFF" },
    });
    const qr = await doc.embedPng(png);
    const size = 40;
    page.drawImage(qr, { x: x + (CARD_W - size) / 2, y: y + 20, width: size, height: size });
  } catch {
    /* a badge without a QR still works, it is just typed in instead */
  }

  const codeSize = 8;
  page.drawText(input.passcode, {
    x: x + (CARD_W - sansBold.widthOfTextAtSize(input.passcode, codeSize)) / 2,
    y: y + 10, size: codeSize, font: sansBold, color: ink,
  });

  if (input.membershipNo) {
    const s = 5;
    page.drawText(input.membershipNo, {
      x: x + (CARD_W - sans.widthOfTextAtSize(input.membershipNo, s)) / 2,
      y: y + 3.5, size: s, font: sans, color: muted,
    });
  }
}

export async function buildPhotoCard(input: PhotoCardInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Participant card — ${input.name}`);
  doc.setSubject(input.eventTitle);

  if (!input.forPrinting) {
    // Exactly the card, nothing else: what a badge printer expects.
    const page = doc.addPage([CARD_W, CARD_H]);
    await drawCard(doc, page, 0, 0, input);
    return doc.save();
  }

  // A4 with the card centred and crop marks, for printing at home.
  const A4_W = 595.28;
  const A4_H = 841.89;
  const page = doc.addPage([A4_W, A4_H]);

  const x = (A4_W - CARD_W) / 2;
  const y = A4_H - 170 - CARD_H;

  await drawCard(doc, page, x, y, input);

  const mark = rgb(0.6, 0.64, 0.62);
  const len = 14;
  const gap = 6;
  const corners: [number, number, number, number][] = [
    [x - gap - len, y, x - gap, y],
    [x - gap - len, y + CARD_H, x - gap, y + CARD_H],
    [x + CARD_W + gap, y, x + CARD_W + gap + len, y],
    [x + CARD_W + gap, y + CARD_H, x + CARD_W + gap + len, y + CARD_H],
    [x, y - gap - len, x, y - gap],
    [x + CARD_W, y - gap - len, x + CARD_W, y - gap],
    [x, y + CARD_H + gap, x, y + CARD_H + gap + len],
    [x + CARD_W, y + CARD_H + gap, x + CARD_W, y + CARD_H + gap + len],
  ];
  for (const [x1, y1, x2, y2] of corners) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.4, color: mark });
  }

  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const note = "Print at 100% — do not select 'fit to page' — then cut along the marks.";
  page.drawText(note, {
    x: (A4_W - sans.widthOfTextAtSize(note, 9)) / 2,
    y: y - 60, size: 9, font: sans, color: rgb(0.42, 0.46, 0.44),
  });

  const note2 = "The card is 54 by 85.6mm, the size of a bank card.";
  page.drawText(note2, {
    x: (A4_W - sans.widthOfTextAtSize(note2, 8)) / 2,
    y: y - 74, size: 8, font: sans, color: rgb(0.6, 0.64, 0.62),
  });

  return doc.save();
}