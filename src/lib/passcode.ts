/**
 * Passcode format: EBY4-9K7C.
 * Alphabet excludes O/0 and I/1/L — the characters people misread when
 * copying a code off a phone screen or reading it out over the phone.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePasscode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Accepts eby49k7c, EBY4 9K7C, EBY4-9K7C — all normalise to EBY4-9K7C. */
export function normalisePasscode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 8) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function certificateSerial(year: number, seq: number): string {
  return `NIESV-EB-${year}-${String(seq).padStart(4, "0")}`;
}
