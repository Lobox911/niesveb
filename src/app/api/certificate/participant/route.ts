import { requireOfficer } from "@/lib/auth";
import { issueCertificate } from "@/lib/issue-certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One participant's real certificate, for an officer to look at before any of
 * it is sent.
 *
 * Deliberately the same code path the participant's own download uses, so what
 * the officer checks is what the participant receives — a preview built by a
 * second, "near enough" renderer would be worse than no preview at all.
 *
 * It does mint the serial as a side effect, which is correct: the number
 * belongs to that registration from the moment one exists, and looking at the
 * document is not a reason to burn a different one later.
 */
export async function GET(request: Request) {
  await requireOfficer();

  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "No participant selected." }, { status: 400 });
  }

  // An officer previewing is allowed to see what an override would produce;
  // issuing it to anybody still goes through the dashboard's own check.
  const res = await issueCertificate(id, url.origin, { skipAttendanceCheck: true });

  if (!res.ok) {
    const message =
      res.reason === "not-confirmed"
        ? "That payment has not been confirmed yet."
        : "That registration could not be found.";
    return Response.json({ error: message }, { status: 404 });
  }

  return new Response(res.pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // Inline: this is for looking at, not filing.
      "Content-Disposition": `inline; filename="${res.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}