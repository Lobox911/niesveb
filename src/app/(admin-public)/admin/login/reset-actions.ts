"use server";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, officers, passwordResets, auditLog } from "@/db";
import { hashPassword } from "@/lib/auth";
import { getBranch } from "@/lib/site";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * Password recovery for branch officers.
 *
 * Previously there was none: a lost password meant another administrator had
 * to reset it, and with a single administrator — which the readiness check
 * warns about — it meant nobody could get in at all.
 */

const TOKEN_MINUTES = 60;

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

async function siteUrl() {
  const branch = await getBranch();
  if (branch.canonicalUrl) return branch.canonicalUrl;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

/**
 * Always reports success.
 *
 * Saying "no account with that address" would turn this form into a way to
 * discover which addresses are branch officers, which is the first half of an
 * attack on them.
 */
export async function requestPasswordReset(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter the email address of your officer account." };
  }

  const rows = await db
    .select({ id: officers.id, name: officers.name, active: officers.active })
    .from(officers)
    .where(eq(officers.email, email))
    .limit(1);

  const officer = rows[0];

  if (officer && officer.active) {
    // Any link already outstanding is retired, so the newest email is the only
    // one that works and an older message cannot be replayed.
    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.officerId, officer.id), isNull(passwordResets.usedAt)));

    const token = randomBytes(32).toString("hex");
    const h = await headers();

    await db.insert(passwordResets).values({
      officerId: officer.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
      requestedIp: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    await sendPasswordResetEmail({
      to: email,
      name: officer.name,
      url: `${await siteUrl()}/admin/login/reset?token=${token}`,
      minutes: TOKEN_MINUTES,
    }).catch(() => false);

    await db.insert(auditLog).values({
      officerId: officer.id,
      action: "request_password_reset",
      targetTable: "officers",
      targetId: officer.id,
    });
  }

  return { ok: true };
}

/** Checks a token without spending it, for rendering the form. */
export async function checkResetToken(token: string) {
  if (!token || token.length !== 64) return { valid: false as const };

  const rows = await db
    .select({ id: passwordResets.id, officerId: passwordResets.officerId, name: officers.name })
    .from(passwordResets)
    .innerJoin(officers, eq(officers.id, passwordResets.officerId))
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
        eq(officers.active, true),
      ),
    )
    .limit(1);

  return rows[0] ? { valid: true as const, name: rows[0].name } : { valid: false as const };
}

export async function completePasswordReset(_prev: unknown, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10) {
    return { error: "The password must be at least 10 characters." };
  }
  // Compared in constant time out of habit rather than necessity; both values
  // came from the same form.
  if (
    password.length !== confirm.length ||
    !timingSafeEqual(Buffer.from(password), Buffer.from(confirm))
  ) {
    return { error: "The two passwords do not match." };
  }

  const rows = await db
    .select({ id: passwordResets.id, officerId: passwordResets.officerId })
    .from(passwordResets)
    .innerJoin(officers, eq(officers.id, passwordResets.officerId))
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
        eq(officers.active, true),
      ),
    )
    .limit(1);

  const reset = rows[0];
  if (!reset) {
    return { error: "This link has expired or has already been used. Request a new one." };
  }

  // Spend the token first. If the password write fails afterwards the link is
  // dead and must be re-requested, which is the safe way round.
  const spent = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.id, reset.id), isNull(passwordResets.usedAt)))
    .returning({ id: passwordResets.id });

  if (!spent[0]) {
    return { error: "This link has already been used. Request a new one." };
  }

  await db
    .update(officers)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(officers.id, reset.officerId));

  await db.insert(auditLog).values({
    officerId: reset.officerId,
    action: "complete_password_reset",
    targetTable: "officers",
    targetId: reset.officerId,
  });

  return { ok: true };
}