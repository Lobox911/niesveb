import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

/**
 * The certificate, as a PDF.
 *
 * Vector text rather than a rendered image: a name set as text stays sharp
 * whatever it is printed at, and a 60KB PDF sends where a 300dpi PNG does not.
 *
 * Two modes. With no artwork the code draws the whole thing — border, crest,
 * rules, signatures. With artwork from the branch's printer, only the variable
 * text is drawn on top and the code draws no frame, because a second border
 * over a designed certificate looks like a mistake.
 *
 * A4 landscape, 842 x 595pt.
 */

const PAGE_W = 842;
const PAGE_H = 595;

/** Which parts are printed. A missing key means on. */
export type CertificateParts = {
  crest?: boolean;
  branchName?: boolean;
  heading?: boolean;
  border?: boolean;
  certifyLine?: boolean;
  statement?: boolean;
  theme?: boolean;
  units?: boolean;
  signatures?: boolean;
  qr?: boolean;
  serial?: boolean;
  verifyLine?: boolean;
};

export type ExtraLine = {
  text: string;
  /** Where it goes in the stack. */
  place: "underHeading" | "underName" | "underStatement" | "aboveSignatures" | "footer";
  size?: "small" | "normal" | "large";
  style?: "plain" | "italic" | "bold";
};

export type CertificateInput = {
  name: string;
  category: string;
  units: number;
  serial: string;
  issuedAt: Date;

  eventTitle: string;
  eventTheme: string;
  eventDate: string;
  venue: string;

  branchName: string;
  statement: string;

  chairmanName: string;
  chairmanTitle: string;
  secretaryName: string;
  secretaryTitle: string;

  verifyUrl: string;
  /** Printed under the QR. The URL itself is often percent-encoded. */
  verifyLabel: string;

  parts?: CertificateParts;
  extraLines?: ExtraLine[];

  primaryHex: string;
  accentHex: string;

  /** All optional. Anything missing is simply not drawn. */
  crest?: Uint8Array | null;
  crestType?: "png" | "jpg" | null;
  background?: Uint8Array | null;
  backgroundType?: "png" | "jpg" | null;
  chairmanSignature?: Uint8Array | null;
  chairmanSignatureType?: "png" | "jpg" | null;
  secretarySignature?: Uint8Array | null;
  secretarySignatureType?: "png" | "jpg" | null;
};

function hex(h: string, fallback: [number, number, number]) {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return rgb(fallback[0] / 255, fallback[1] / 255, fallback[2] / 255);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Centre a line of text on the page. */
function centre(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: ReturnType<typeof rgb>) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color });
}

/**
 * Shrink until it fits rather than wrap.
 *
 * A participant's name is one line by definition, and a two-line name on a
 * certificate reads as a layout failure. Long Nigerian names with titles and
 * several given names do occur, so the size steps down instead.
 */
function centreFitted(
  page: PDFPage, text: string, font: PDFFont,
  maxSize: number, minSize: number, maxWidth: number, y: number,
  color: ReturnType<typeof rgb>,
) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color });
  return size;
}

/** Wrap to a width, centred, returning the y after the last line. */
function centreWrapped(
  page: PDFPage, text: string, font: PDFFont, size: number,
  maxWidth: number, y: number, leading: number, color: ReturnType<typeof rgb>,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  let cursor = y;
  for (const l of lines) {
    centre(page, l, font, size, cursor, color);
    cursor -= leading;
  }
  return cursor;
}

async function embed(
  doc: PDFDocument,
  bytes: Uint8Array | null | undefined,
  type: "png" | "jpg" | null | undefined,
) {
  if (!bytes || bytes.length === 0) return null;
  try {
    // The stored type can be wrong — a .png that is really a JPEG happens when
    // someone renames a file. Try the other one before giving up, since a
    // missing crest is a worse outcome than a wasted parse.
    if (type === "jpg") {
      try { return await doc.embedJpg(bytes); } catch { return await doc.embedPng(bytes); }
    }
    try { return await doc.embedPng(bytes); } catch { return await doc.embedJpg(bytes); }
  } catch {
    return null;
  }
}

export async function buildCertificate(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificate of Participation — ${input.name}`);
  doc.setSubject(input.eventTitle);
  doc.setProducer(input.branchName);
  doc.setCreationDate(input.issuedAt);

  const page = doc.addPage([PAGE_W, PAGE_H]);

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  const ink = rgb(0.06, 0.12, 0.18);
  const muted = rgb(0.36, 0.4, 0.38);
  const primary = hex(input.primaryHex, [11, 110, 79]);
  const accent = hex(input.accentHex, [176, 138, 46]);

  // A part is on unless it has been explicitly switched off, so a branch that
  // never opens the designer gets the whole certificate.
  const on = (k: keyof CertificateParts) => input.parts?.[k] !== false;

  const SIZES = { small: 10, normal: 12.5, large: 16 } as const;

  /** Draws whatever the branch wrote for one position, and returns the new y. */
  const extras = (place: ExtraLine["place"], y: number) => {
    const lines = (input.extraLines ?? []).filter(
      (l) => l.place === place && l.text.trim(),
    );
    let cursor = y;
    for (const l of lines) {
      const size = SIZES[l.size ?? "normal"];
      const font = l.style === "bold" ? serifBold : l.style === "italic" ? serifItalic : serif;
      cursor = centreWrapped(page, l.text.trim(), font, size, PAGE_W - 200, cursor, size + 6, muted);
      cursor -= 6;
    }
    return cursor;
  };

  const background = await embed(doc, input.background, input.backgroundType);

  if (background) {
    page.drawImage(background, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } else {
    // Drawn certificate: a double rule rather than a decorative border, which
    // is what an institution actually issues.
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });
    if (on("border")) {
      page.drawRectangle({
        x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48,
        borderColor: primary, borderWidth: 2,
      });
      page.drawRectangle({
        x: 32, y: 32, width: PAGE_W - 64, height: PAGE_H - 64,
        borderColor: accent, borderWidth: 0.75,
      });
    }
  }

  let y = PAGE_H - 78;

  // The crest sits above everything, and only when there is no artwork — a
  // designed certificate already carries one.
  if (!background) {
    const crest = on("crest") ? await embed(doc, input.crest, input.crestType) : null;
    if (crest) {
      const h = 56;
      const w = (crest.width / crest.height) * h;
      page.drawImage(crest, { x: (PAGE_W - w) / 2, y: y - h + 14, width: w, height: h });
      y -= h + 6;
    }

    if (on("branchName")) {
      centre(page, input.branchName.toUpperCase(), sans, 11, y, muted);
      y -= 34;
    }

    if (on("heading")) {
      centre(page, "CERTIFICATE OF PARTICIPATION", serifBold, 26, y, ink);
      y -= 12;
      page.drawLine({
        start: { x: PAGE_W / 2 - 90, y },
        end: { x: PAGE_W / 2 + 90, y },
        thickness: 1.5, color: accent,
      });
      y -= 44;
    }

    y = extras("underHeading", y);
  } else {
    // Artwork supplies the heading; start lower and draw only the variables.
    y = PAGE_H - 210;
  }

  if (on("certifyLine")) {
    centre(page, "This is to certify that", serifItalic, 13, y, muted);
    y -= 50;
  }

  centreFitted(page, input.name, serifBold, 34, 18, PAGE_W - 220, y, primary);
  y -= 16;

  page.drawLine({
    start: { x: 150, y }, end: { x: PAGE_W - 150, y },
    thickness: 0.75, color: rgb(0.85, 0.87, 0.85),
  });
  y -= 30;

  y = extras("underName", y);
  y -= 10;

  const statement = input.statement
    .replace("{event}", input.eventTitle)
    .replace("{theme}", input.eventTheme)
    .replace("{date}", input.eventDate)
    .replace("{venue}", input.venue)
    .replace("{units}", String(input.units))
    .replace("{category}", input.category);

  if (on("statement")) {
    y = centreWrapped(page, statement, serif, 13.5, PAGE_W - 200, y, 22, ink);
    y -= 10;
  }

  if (on("theme") && input.eventTheme) {
    y = centreWrapped(page, `"${input.eventTheme}"`, serifItalic, 12.5, PAGE_W - 240, y, 18, muted);
    y -= 14;
  }

  y = extras("underStatement", y);

  // Credit points get their own line: it is the reason the document exists.
  if (on("units")) {
    centre(page, `${input.units} MCPD CREDIT ${input.units === 1 ? "UNIT" : "UNITS"}`, sans, 11, y - 6, accent);
    y -= 22;
  }

  extras("aboveSignatures", y - 8);

  /* ---- signatures ---- */

  // 150 rather than 108: below that the serial and verify lines collide with
  // the inner rule at y=32, which is what clipped them the first time.
  const sigY = 150;
  const columns: {
    name: string; title: string;
    image: Uint8Array | null | undefined; type: "png" | "jpg" | null | undefined;
    cx: number;
  }[] = [
    { name: input.chairmanName, title: input.chairmanTitle, image: input.chairmanSignature, type: input.chairmanSignatureType, cx: 232 },
    { name: input.secretaryName, title: input.secretaryTitle, image: input.secretarySignature, type: input.secretarySignatureType, cx: PAGE_W - 232 },
  ];

  for (const col of columns) {
    if (!col.name || !on("signatures")) continue;

    const sig = await embed(doc, col.image, col.type);
    if (sig) {
      const h = 34;
      const w = Math.min((sig.width / sig.height) * h, 170);
      page.drawImage(sig, { x: col.cx - w / 2, y: sigY + 6, width: w, height: h });
    }

    page.drawLine({
      start: { x: col.cx - 95, y: sigY }, end: { x: col.cx + 95, y: sigY },
      thickness: 0.75, color: rgb(0.7, 0.73, 0.7),
    });

    const nameW = serifBold.widthOfTextAtSize(col.name, 12);
    page.drawText(col.name, { x: col.cx - nameW / 2, y: sigY - 16, size: 12, font: serifBold, color: ink });

    const titleW = sans.widthOfTextAtSize(col.title.toUpperCase(), 8.5);
    page.drawText(col.title.toUpperCase(), {
      x: col.cx - titleW / 2, y: sigY - 29, size: 8.5, font: sans, color: muted,
    });
  }

  /* ---- verification ---- */

  // A certificate nobody can check is decoration. The QR and the serial are
  // what make this a record.
  if (on("qr")) try {
    const png = await QRCode.toDataURL(input.verifyUrl, {
      margin: 0, width: 240, errorCorrectionLevel: "M",
      color: { dark: "#101E2E", light: "#FFFFFF" },
    });
    const qr = await doc.embedPng(png);
    const size = 60;
    // Horizontally centred, so it sits between the two signature columns
    // rather than under either of them.
    page.drawImage(qr, { x: PAGE_W / 2 - size / 2, y: 78, width: size, height: size });
  } catch {
    // No QR is survivable; a failed download is not.
  }

  if (on("serial")) {
    centre(page, `Serial ${input.serial}`, sans, 8.5, 62, muted);
  }
  if (on("verifyLine")) {
    // The bare domain, not the full link: the encoded serial in the real URL
    // renders as %2F and reads like a mistake. The QR carries the full address.
    centre(page, `Verify at ${input.verifyLabel}`, sans, 7.5, 50, muted);
  }

  extras("footer", 40);

  return doc.save();
}