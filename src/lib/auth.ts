import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db, officers } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Deliberately dependency-free: HMAC-signed cookie + scrypt password hashing,
 * both from node:crypto. No bcrypt (native build), no next-auth (heavy for
 * five officers who never self-register).
 *
 * There is NO public signup route. Officers are inserted by an admin via
 * `npm run officer:add`.
 */

const COOKIE = "niesv_officer";
const MAX_AGE = 60 * 60 * 8; // 8 hours — a working day at the registration desk

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET missing or too short (needs 32+ chars).");
  }
  return s;
}

/* ---------- passwords ---------- */

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/* ---------- sessions ---------- */

type Session = { id: string; name: string; role: "officer" | "admin"; exp: number };

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): Session | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  // Compare signatures in constant time.
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export async function createSession(officer: { id: string; name: string; role: "officer" | "admin" }) {
  const jar = await cookies();
  jar.set(COOKIE, encode({ ...officer, exp: Date.now() + MAX_AGE * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decode(token) : null;
}

/** Use at the top of every admin page and action. */
export async function requireOfficer(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORISED");
  return s;
}

/* ---------- login ---------- */

export async function authenticate(email: string, password: string) {
  const rows = await db
    .select()
    .from(officers)
    .where(eq(officers.email, email.toLowerCase().trim()))
    .limit(1);

  const officer = rows[0];

  // Run the hash comparison even when the officer is missing, so a wrong
  // email and a wrong password take the same time to fail.
  const stored = officer?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`;
  const ok = verifyPassword(password, stored);

  if (!officer || !ok || !officer.active) return null;
  return { id: officer.id, name: officer.name, role: officer.role };
}
