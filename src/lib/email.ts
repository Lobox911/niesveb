import { getBranch } from "./site";

/**
 * Email is optional at runtime.
 *
 * Without RESEND_API_KEY every send is a no-op that logs and returns false.
 * The portal still issues passcodes and the participant still sees theirs on
 * screen — so registration works before the sending domain is verified, and
 * starts delivering the moment the key is added. Nothing needs redeploying
 * except the environment variable.
 */

const FROM = process.env.MAIL_FROM || "";
const KEY = process.env.RESEND_API_KEY || "";

export const emailEnabled = () => Boolean(KEY && FROM);

async function send(to: string, subject: string, html: string) {
  if (!emailEnabled()) {
    console.warn(`[email] skipped "${subject}" to ${to} — RESEND_API_KEY or MAIL_FROM not set`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email] failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] error", e);
    return false;
  }
}

/** Plain HTML, no images, no tracking. A new domain has no sending
 *  reputation, and heavy markup is what tips a first email into spam. */
function wrap(branchName: string, body: string) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#101E2E;max-width:560px">
${body}
<hr style="border:none;border-top:1px solid #DDE2DD;margin:24px 0">
<p style="font-size:13px;color:#5C6660">${branchName}</p>
</div>`;
}

export async function sendPasscodeEmail(opts: {
  to: string;
  name: string;
  passcode: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  amountLabel: string;
  siteUrl: string;
}) {
  const branch = await getBranch();
  const body = `
<p>Dear ${opts.name},</p>
<p>Your registration for the <strong>${opts.eventTitle}</strong> has been received.</p>
<p style="font-family:ui-monospace,monospace;font-size:26px;letter-spacing:4px;margin:24px 0">${opts.passcode}</p>
<p>Keep this code. You will need it to join the session online, to print your
photo card, and to download your certificate of participation.</p>
<p><strong>Date:</strong> ${opts.eventDate}<br>
<strong>Venue:</strong> ${opts.venue}<br>
<strong>Amount declared:</strong> ${opts.amountLabel}</p>
<p>Your payment is being confirmed by the branch. Until it is confirmed the
code works for your photo card but not for the certificate.</p>
<p><a href="${opts.siteUrl}/retrieve">Retrieve this code again</a> at any time.</p>`;
  return send(opts.to, `Your registration code for ${opts.eventTitle}`, wrap(branch.branchName, body));
}

export async function sendConfirmedEmail(opts: {
  to: string; name: string; passcode: string; eventTitle: string;
}) {
  const branch = await getBranch();
  const body = `
<p>Dear ${opts.name},</p>
<p>Your payment for the <strong>${opts.eventTitle}</strong> has been confirmed.</p>
<p style="font-family:ui-monospace,monospace;font-size:26px;letter-spacing:4px;margin:24px 0">${opts.passcode}</p>
<p>Your certificate of participation will open after the seminar, once your
attendance has been recorded.</p>`;
  return send(opts.to, `Payment confirmed — ${opts.eventTitle}`, wrap(branch.branchName, body));
}

export async function sendRejectedEmail(opts: {
  to: string; name: string; eventTitle: string; reason: string;
}) {
  const branch = await getBranch();
  const body = `
<p>Dear ${opts.name},</p>
<p>We could not confirm your payment for the <strong>${opts.eventTitle}</strong>.</p>
<p style="background:#F7F8F6;border-left:2px solid #B08A2E;padding:12px 16px">${opts.reason}</p>
<p>Please contact the branch to resolve this.</p>`;
  return send(opts.to, `Payment could not be confirmed — ${opts.eventTitle}`, wrap(branch.branchName, body));
}