import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The certificate, as a PDF.
 *
 * Vector text rather than a rendered image: a name set as text stays sharp
 * whatever it is printed at, and a 90KB PDF sends where a 300dpi PNG does not.
 *
 * The layout follows the certificates NIESV branches already issue — Imo 2023,
 * Kaduna 2018, National 2021 and 2024 — which share one skeleton: institution
 * and branch at the head, a script title, the name large on a ruled line, the
 * MCPD approval sentence, theme, date and venue, then signatures flanking a
 * seal. Colours are the branch's own seminar banner.
 *
 * Two modes. With no artwork the code draws the whole thing. With artwork from
 * the branch's printer, only the variable text is drawn on top and the code
 * draws no frame, because a second border over a designed certificate looks
 * like a mistake.
 *
 * A4 landscape, 842 x 595pt.
 */

const PAGE_W = 841.89;
const PAGE_H = 595.28;

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
  /** The crest printed faintly behind everything. */
  watermark?: boolean;
  seal?: boolean;
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
  /** "Nigerian Institution of Estate Surveyors and Valuers" by default. */
  institutionName?: string;
  statement: string;
  /** "Certificate of Participation" or "… of Attendance". */
  headingText?: string;

  chairmanName: string;
  chairmanTitle: string;
  chairmanPostNominals?: string;
  secretaryName: string;
  secretaryTitle: string;
  secretaryPostNominals?: string;

  verifyUrl: string;
  /** Printed in the footer. The URL itself is often percent-encoded. */
  verifyLabel: string;

  parts?: CertificateParts;
  extraLines?: ExtraLine[];

  primaryHex: string;
  accentHex: string;
  /** 0 to 1. Zero leaves the watermark off whatever the toggle says. */
  watermarkOpacity?: number;

  /** All optional. Anything missing is simply not drawn. */
  crest?: Uint8Array | null;
  crestType?: "png" | "jpg" | null;
  /** The second crest, top right — ESVARBON on an MCPD certificate. */
  secondCrest?: Uint8Array | null;
  secondCrestType?: "png" | "jpg" | null;
  /** Printed faintly behind the text. Falls back to the branch crest. */
  watermark?: Uint8Array | null;
  watermarkType?: "png" | "jpg" | null;
  background?: Uint8Array | null;
  backgroundType?: "png" | "jpg" | null;
  chairmanSignature?: Uint8Array | null;
  chairmanSignatureType?: "png" | "jpg" | null;
  secretarySignature?: Uint8Array | null;
  secretarySignatureType?: "png" | "jpg" | null;
};

/* ---------- fonts ---------- */

/**
 * The faces are read from disk at request time rather than imported.
 *
 * They are also declared in next.config.mjs under outputFileTracingIncludes.
 * Next traces a serverless function's files by following imports, and a
 * readFileSync of a path it never sees gets left out of the bundle — which
 * works perfectly in development and throws on every certificate in
 * production. The config entry is what puts them in the deployment.
 */
const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
const fontFile = (name: string) => readFileSync(path.join(FONT_DIR, name));

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
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
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

/** The embossed-look seal the branch certificates carry between signatures. */
function drawSeal(page: PDFPage, cx: number, cy: number, r: number, color: ReturnType<typeof rgb>) {
  const points = 28;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    page.drawCircle({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, size: r * 0.1, color });
  }
  page.drawCircle({ x: cx, y: cy, size: r, color });
  page.drawCircle({ x: cx, y: cy, size: r * 0.8, borderColor: rgb(1, 1, 1), borderWidth: 1.1 });
}

export async function buildCertificate(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${input.headingText ?? "Certificate of Participation"} — ${input.name}`);
  doc.setSubject(input.eventTitle);
  doc.setProducer(input.branchName);
  doc.setCreationDate(input.issuedAt);

  const page = doc.addPage([PAGE_W, PAGE_H]);

  const script = await doc.embedFont(fontFile("PinyonScript-Regular.ttf"));
  const display = await doc.embedFont(fontFile("Playfair-Bold.ttf"));
  const body = await doc.embedFont(fontFile("SourceSerif-SemiBold.ttf"));
  const bold = await doc.embedFont(fontFile("SourceSerif-Bold.ttf"));
  const { StandardFonts } = await import("pdf-lib");
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const primary = hex(input.primaryHex, [0, 30, 76]);   // navy
  const accent = hex(input.accentHex, [234, 4, 17]);    // red
  const ink = rgb(0.04, 0.07, 0.23);
  const muted = rgb(0.16, 0.19, 0.26);

  // A part is on unless explicitly switched off, so a branch that never opens
  // the designer gets the whole certificate.
  const on = (k: keyof CertificateParts) => input.parts?.[k] !== false;

  const SIZES = { small: 10, normal: 12.5, large: 16 } as const;

  /** Draws whatever the branch wrote for one position, and returns the new y. */
  const extras = (place: ExtraLine["place"], y: number) => {
    const lines = (input.extraLines ?? []).filter((l) => l.place === place && l.text.trim());
    let cursor = y;
    for (const l of lines) {
      const size = SIZES[l.size ?? "normal"];
      const font = l.style === "bold" ? bold : l.style === "italic" ? display : body;
      cursor = centreWrapped(page, l.text.trim(), font, size, PAGE_W - 200, cursor, size + 6, muted);
      cursor -= 6;
    }
    return cursor;
  };

  const background = await embed(doc, input.background, input.backgroundType);
  const crest = await embed(doc, input.crest, input.crestType);
  const secondCrest = await embed(doc, input.secondCrest, input.secondCrestType);
  // Its own image when the branch set one, the crest when they did not.
  const mark = (await embed(doc, input.watermark, input.watermarkType)) ?? crest;

  if (background) {
    page.drawImage(background, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } else {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });

    /* The crest, very large and very faint, behind everything else. Drawn here
       because pdf-lib paints in call order — added later it would sit on top
       of the text it is meant to sit behind. */
    const opacity = input.watermarkOpacity ?? 0.05;
    if (on("watermark") && mark && opacity > 0) {
      const h = 330;
      const w = (mark.width / mark.height) * h;
      page.drawImage(mark, {
        x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2 - 10,
        width: w, height: h, opacity,
      });
    }

    if (on("border")) {
      page.drawRectangle({
        x: 16, y: 16, width: PAGE_W - 32, height: PAGE_H - 32,
        borderColor: primary, borderWidth: 2.5,
      });
      page.drawRectangle({
        x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48,
        borderColor: accent, borderWidth: 0.7,
      });
      const bracket = (x: number, y: number, dx: number, dy: number) => {
        page.drawLine({ start: { x, y }, end: { x: x + dx * 26, y }, thickness: 2.5, color: primary });
        page.drawLine({ start: { x, y }, end: { x, y: y + dy * 26 }, thickness: 2.5, color: primary });
      };
      bracket(34, 34, 1, 1); bracket(PAGE_W - 34, 34, -1, 1);
      bracket(34, PAGE_H - 34, 1, -1); bracket(PAGE_W - 34, PAGE_H - 34, -1, -1);
    }
  }

  let y = PAGE_H - 70;

  if (!background) {
    if (on("branchName")) {
      centre(page, (input.institutionName ?? "Nigerian Institution of Estate Surveyors and Valuers").toUpperCase(),
        sansBold, 14.5, y, primary);
      y -= 18;
      // Letter-spaced by hand: pdf-lib has no tracking, and the branch line
      // needs to read as a subhead rather than a second title.
      centre(page, input.branchName.toUpperCase().split("").join(" "), sansBold, 10.5, y, muted);
      y -= 10;
      page.drawLine({
        start: { x: PAGE_W / 2 - 90, y }, end: { x: PAGE_W / 2 + 90, y },
        thickness: 1.2, color: accent,
      });
    }

    /* The two crests, sized by height so they read as a pair despite different
       aspect ratios. They are the first thing anyone looks for. */
    if (on("crest")) {
      const h = 74;
      if (crest) {
        const w = (crest.width / crest.height) * h;
        page.drawImage(crest, { x: 54, y: PAGE_H - 46 - h, width: w, height: h });
      }
      if (secondCrest) {
        const w = (secondCrest.width / secondCrest.height) * h;
        page.drawImage(secondCrest, { x: PAGE_W - 54 - w, y: PAGE_H - 46 - h, width: w, height: h });
      }
    }

    if (on("heading")) {
      y -= 54;
      centre(page, input.headingText ?? "Certificate of Participation", script, 53, y, accent);
    }

    y = extras("underHeading", y);
  } else {
    // Artwork supplies the heading; start lower and draw only the variables.
    y = PAGE_H - 210;
  }

  if (on("certifyLine")) {
    y -= 30;
    centre(page, "This is to certify that", body, 13.5, y, muted);
  }

  y -= 44;
  centreFitted(page, input.name.toUpperCase(), display, 34, 18, PAGE_W - 240, y, primary);

  y -= 16;
  page.drawLine({
    start: { x: 160, y }, end: { x: PAGE_W - 160, y },
    thickness: 0.8, color: rgb(0.8, 0.8, 0.82),
  });

  y = extras("underName", y - 12);

  const statement = input.statement
    .replace("{event}", input.eventTitle)
    .replace("{theme}", input.eventTheme)
    .replace("{date}", input.eventDate)
    .replace("{venue}", input.venue)
    .replace("{units}", String(input.units))
    .replace("{category}", input.category);

  if (on("statement")) {
    y -= 18;
    y = centreWrapped(page, statement, body, 13, PAGE_W - 200, y, 18, ink);
  }

  if (on("theme") && input.eventTheme) {
    y -= 4;
    centre(page, "T H E M E", sansBold, 8.5, y, primary);
    y -= 19;
    y = centreWrapped(page, input.eventTheme, bold, 15.5, PAGE_W - 230, y, 21, accent);
  }

  y -= 8;
  centre(page, `${input.eventDate}   ·   ${input.venue}`, bold, 12.5, y, ink);

  if (on("units")) {
    y -= 22;
    centre(page, `THIS SEMINAR HAS BEEN AWARDED ${input.units} MCPD CREDIT ${input.units === 1 ? "POINT" : "POINTS"} BY ESVARBON`,
      sansBold, 9, y, accent);
  }

  extras("aboveSignatures", y - 20);

  /* ---- signatures ---- */

  const sigY = 146;
  const columns = [
    {
      name: input.chairmanName, title: input.chairmanTitle,
      post: input.chairmanPostNominals ?? "",
      image: input.chairmanSignature, type: input.chairmanSignatureType, cx: 200,
    },
    {
      name: input.secretaryName, title: input.secretaryTitle,
      post: input.secretaryPostNominals ?? "",
      image: input.secretarySignature, type: input.secretarySignatureType, cx: PAGE_W - 200,
    },
  ];

  if (on("signatures")) {
    for (const col of columns) {
      if (!col.name) continue;

      const sig = await embed(doc, col.image, col.type);
      if (sig) {
        const h = 38;
        const w = Math.min((sig.width / sig.height) * h, 180);
        page.drawImage(sig, { x: col.cx - w / 2, y: sigY + 6, width: w, height: h });
      }

      page.drawLine({
        start: { x: col.cx - 108, y: sigY }, end: { x: col.cx + 108, y: sigY },
        thickness: 0.8, color: rgb(0.55, 0.57, 0.6),
      });

      const nameW = bold.widthOfTextAtSize(col.name.toUpperCase(), 11.5);
      page.drawText(col.name.toUpperCase(), {
        x: col.cx - nameW / 2, y: sigY - 14, size: 11.5, font: bold, color: primary,
      });

      // Postnominals are skipped rather than faked when the branch has not
      // supplied them — an invented qualification on a professional
      // certificate is not a small error.
      if (col.post) {
        const pw = sansBold.widthOfTextAtSize(col.post, 8.5);
        page.drawText(col.post, { x: col.cx - pw / 2, y: sigY - 24, size: 8.5, font: sansBold, color: muted });
      }

      const tw = bold.widthOfTextAtSize(col.title, 10.5);
      page.drawText(col.title, {
        x: col.cx - tw / 2, y: sigY - (col.post ? 40 : 31), size: 10.5, font: bold, color: accent,
      });
    }

    if (on("seal") && !background) drawSeal(page, PAGE_W / 2, sigY - 4, 26, accent);
  }

  /* ---- verification ---- */

  // A certificate nobody can check is decoration. The serial and the QR are
  // what make this a record. The QR sits in the corner rather than the middle
  // so it does not interrupt the composition.
  /* Bottom right, clear of the corner bracket — at the left it overlapped the
     bracket's arms, which read as a printing fault rather than a code. */
  const QR_SIZE = 44;
  let verifyRight = PAGE_W - 44;

  if (on("qr")) try {
    const png = await QRCode.toDataURL(input.verifyUrl, {
      margin: 0, width: 240, errorCorrectionLevel: "M",
      color: { dark: "#001E4C", light: "#FFFFFF" },
    });
    const qr = await doc.embedPng(png);
    page.drawImage(qr, { x: PAGE_W - 56 - QR_SIZE, y: 46, width: QR_SIZE, height: QR_SIZE });
    verifyRight = PAGE_W - 56 - QR_SIZE - 12;
  } catch {
    // No QR is survivable; a failed download is not.
  }

  if (on("serial")) {
    page.drawText(input.serial, { x: 48, y: 48, size: 9.5, font: sansBold, color: muted });
  }
  if (on("verifyLine")) {
    const t = `Verify at ${input.verifyLabel}`;
    page.drawText(t, {
      x: verifyRight - sansBold.widthOfTextAtSize(t, 9.5), y: 48,
      size: 9.5, font: sansBold, color: muted,
    });
  }

  extras("footer", 30);

  return doc.save();
}