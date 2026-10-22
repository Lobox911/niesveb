import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Images shipped with the code rather than uploaded.
 *
 * One module so the preview and the real certificate cannot disagree. They
 * did: the bundled ESVARBON crest was wired into the issuing route only, so
 * the designer's preview showed an empty top right while an actual
 * certificate printed the crest. A preview that differs from the document is
 * worse than no preview, because it is trusted.
 *
 * Listed in next.config.mjs under outputFileTracingIncludes — a file read by
 * path and never imported is not traced into a serverless bundle on its own.
 */

export type BundledImage = { bytes: Uint8Array; type: "png" };

function load(file: string): BundledImage | null {
  try {
    return {
      bytes: new Uint8Array(readFileSync(path.join(process.cwd(), "src/assets/brand", file))),
      type: "png",
    };
  } catch {
    return null;
  }
}

/**
 * The ESVARBON crest.
 *
 * It is the same mark on every MCPD certificate in the country and never
 * changes, so requiring it to be found and uploaded is a step that can only go
 * wrong — and did: it was uploaded into the chairman's signature slot, where
 * it printed as his signature. An uploaded crest still wins; this is what
 * prints when there is none.
 */
export const bundledEsvarbon = () => load("esvarbon.png");