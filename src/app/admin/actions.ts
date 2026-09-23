"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, registrations, attendance, auditLog } from "@/db";
import { authenticate, createSession, destroySession, requireOfficer } from "@/lib/auth";
import { normalisePasscode } from "@/lib/passcode";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const officer = await authenticate(email, password);
  if (!officer) {
    return { error: "That email and password do not match an active officer account." };
  }
  await createSession(officer);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

/** Audit every state change. This is money handling. */
async function audit(officerId: string, action: string, targetId: string, detail?: unknown) {
  await db.insert(auditLog).values({
    officerId,
    action,
    targetTable: "registrations",
    targetId,
    detail: detail ? JSON.stringify(detail) : null,
  });
}

export async function confirmPayment(id: string) {
  const officer = await requireOfficer();
  await db
    .update(registrations)
    .set({ status: "confirmed", confirmedBy: officer.id, confirmedAt: new Date(), rejectionReason: null })
    .where(eq(registrations.id, id));
  await audit(officer.id, "confirm_payment", id);
  revalidatePath("/admin");
}

export async function rejectPayment(id: string, reason: string) {
  const officer = await requireOfficer();
  const clean = reason.trim();
  // The reason is emailed to the participant verbatim, so it cannot be blank.
  if (!clean) return { error: "A rejection reason is required. It is sent to the participant." };

  await db
    .update(registrations)
    .set({ status: "rejected", rejectionReason: clean, confirmedBy: officer.id, confirmedAt: new Date() })
    .where(eq(registrations.id, id));
  await audit(officer.id, "reject_payment", id, { reason: clean });
  revalidatePath("/admin");
}

export async function adjustAmount(id: string, amountNaira: number) {
  const officer = await requireOfficer();
  await db.update(registrations).set({ amountKobo: Math.round(amountNaira * 100) }).where(eq(registrations.id, id));
  await audit(officer.id, "adjust_amount", id, { amountNaira });
  revalidatePath("/admin");
}

/** Attendance is append-only: a double scan shows as two rows, never overwrites. */
export async function markAttendance(rawPasscode: string, method: "desk" | "qr" = "desk") {
  const officer = await requireOfficer();
  const passcode = normalisePasscode(rawPasscode);
  if (!passcode) return { error: "That passcode is incomplete. It has eight characters, for example EBY4-9K7C." };

  const rows = await db.select().from(registrations).where(eq(registrations.passcode, passcode)).limit(1);
  const reg = rows[0];
  if (!reg) return { error: `No registration found for ${passcode}.` };
  if (reg.status !== "confirmed") {
    return { error: `${reg.firstName} ${reg.surname} — payment is not confirmed yet. Confirm the payment before marking attendance.` };
  }

  const already = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attendance)
    .where(eq(attendance.registrationId, reg.id));

  await db.insert(attendance).values({ registrationId: reg.id, markedBy: officer.id, method });
  await audit(officer.id, "mark_attendance", reg.id, { method });
  revalidatePath("/admin/attendance");

  return {
    ok: true,
    name: `${reg.title ?? ""} ${reg.firstName} ${reg.surname}`.trim(),
    passcode,
    repeat: (already[0]?.n ?? 0) > 0,
  };
}
