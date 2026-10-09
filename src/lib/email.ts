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

/**
 * The shared shell: a crest and the branch name at the top, the message, a
 * rule, and the branch name again at the foot.
 *
 * Still deliberately light. One small image and no tracking pixels, because
 * heavy image-built markup is what tips mail into spam, and these messages
 * carry a passcode somebody needs — arriving plainly beats arriving prettily.
 *
 * Three things make the header survive real mail clients:
 *
 *  - The branch name is text beside the crest, never baked into the image.
 *    Gmail, Outlook and Apple Mail block remote images until the reader
 *    allows them, so a logo carrying the name would leave the message
 *    anonymous for most people on first open.
 *  - The image is given explicit width and height. Without them Outlook
 *    reserves no space and the layout jumps when the image loads.
 *  - The header has its own white background. A crest on a transparent PNG
 *    disappears against the dark canvas a client applies in dark mode.
 */
function wrap(
  branch: { branchName: string; logoUrl: string | null; canonicalUrl: string },
  body: string,
) {
  /* A relative path would resolve against the mail client, not the site, so
     the crest only goes in when we have an absolute URL for it — and never an
     SVG, which Gmail and Outlook both refuse to render. A crest uploaded as
     SVG is fine on the website and would be a broken box here, so the header
     falls back to the branch name alone. */
  const crest =
    branch.logoUrl
    && /^https?:\/\//.test(branch.logoUrl)
    && !/\.svg(\?|$)/i.test(branch.logoUrl)
      ? `<img src="${branch.logoUrl}" width="44" height="44" alt=""
           style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none">`
      : "";

  /* A table, not flexbox: Outlook on Windows renders through Word, which
     does not lay out flex at all. */
  const header = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"
       style="background:#FFFFFF;border-collapse:collapse;margin:0 0 24px">
  <tr>
    ${crest ? `<td style="padding:0 12px 0 0;vertical-align:middle">${crest}</td>` : ""}
    <td style="vertical-align:middle">
      <span style="font-size:16px;font-weight:600;color:#101E2E">${branch.branchName}</span>
    </td>
  </tr>
</table>`;

  const site = branch.canonicalUrl
    ? `<br><a href="${branch.canonicalUrl}" style="color:#5C6660">${branch.canonicalUrl.replace(/^https?:\/\//, "")}</a>`
    : "";

  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#101E2E;max-width:560px">
${header}
${body}
<hr style="border:none;border-top:1px solid #DDE2DD;margin:24px 0">
<p style="font-size:13px;color:#5C6660">${branch.branchName}${site}</p>
</div>`;
}

/**
 * Sent the moment a registration is submitted. Carries no passcode: the code
 * is what opens the join link and the attendance gate, so it is issued only
 * once an officer has confirmed the payment. This email's job is to say the
 * form arrived, repeat the bank details for anyone who registered before
 * paying, and set the expectation that a second email is coming.
 */
export async function sendRegistrationReceivedEmail(opts: {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  amountLabel: string;
  categoryName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  siteUrl: string;
}) {
  const branch = await getBranch();

  const bank = opts.accountNumber
    ? `<p style="background:#F7F8F6;border-left:2px solid #0B6E4F;padding:12px 16px">
<strong>${opts.bankName}</strong><br>
${opts.accountName}<br>
<span style="font-family:ui-monospace,monospace;font-size:18px;letter-spacing:1px">${opts.accountNumber}</span>
</p>
<p>If you have not yet paid, transfer the fee to the account above and reply to
this message with the receipt.</p>`
    : "";

  const body = `
<p>Dear ${opts.name},</p>
<p>Your registration for the <strong>${opts.eventTitle}</strong> has been received.</p>
<p><strong>Category:</strong> ${opts.categoryName}<br>
<strong>Date:</strong> ${opts.eventDate}<br>
<strong>Venue:</strong> ${opts.venue}<br>
<strong>Fee:</strong> ${opts.amountLabel}</p>
<p>The branch is now checking your payment against the bank record. Once it is
confirmed you will receive a second email with your participation code.</p>
<p>That code is what you will use to join the session online, print your photo
card and download your certificate, so keep the second email.</p>
${bank}
<p>Nothing is required from you in the meantime.</p>`;

  return send(
    opts.to,
    `Registration received — ${opts.eventTitle}`,
    wrap(branch, body),
  );
}

/**
 * The one that matters. This is the first time the participant sees a code,
 * so it repeats the practical details rather than assuming they still have
 * the first email.
 */
export async function sendConfirmedEmail(opts: {
  to: string;
  name: string;
  passcode: string;
  eventTitle: string;
  eventDate?: string;
  venue?: string;
  siteUrl?: string;
}) {
  const branch = await getBranch();

  const details = opts.eventDate
    ? `<p><strong>Date:</strong> ${opts.eventDate}${opts.venue ? `<br><strong>Venue:</strong> ${opts.venue}` : ""}</p>`
    : "";

  const links = opts.siteUrl
    ? `<p>
<a href="${opts.siteUrl}/photo-card">Print your photo card</a><br>
<a href="${opts.siteUrl}/join">Join the session online</a><br>
<a href="${opts.siteUrl}/retrieve">Retrieve this code if you lose it</a>
</p>`
    : "";

  const body = `
<p>Dear ${opts.name},</p>
<p>Your payment for the <strong>${opts.eventTitle}</strong> has been confirmed.
Your participation code is:</p>
<p style="font-family:ui-monospace,monospace;font-size:26px;letter-spacing:4px;margin:24px 0">${opts.passcode}</p>
<p>Keep this code. You will need it to join the session online, to print your
photo card, and to download your certificate of participation.</p>
${details}
${links}
<p>Your certificate opens after the seminar, once your attendance has been
recorded.</p>`;

  return send(opts.to, `Payment confirmed — ${opts.eventTitle}`, wrap(branch, body));
}

/**
 * Sent once, when attendance is first recorded.
 *
 * This is the last thing the portal owes a participant, and the moment they
 * are most likely to act on it — they are still at the venue, or have just
 * left it. Waiting for them to remember to come back to the site weeks later
 * is how a certificate goes undownloaded.
 *
 * Deliberately not an attachment. A few hundred PDFs through a new sending
 * domain is how that domain gets a spam reputation, and a link lets them
 * download it again later without asking anyone.
 */
export async function sendCertificateReadyEmail(opts: {
  to: string;
  name: string;
  passcode: string;
  eventTitle: string;
  units: number;
  siteUrl: string;
}) {
  const branch = await getBranch();
  const body = `
<p>Dear ${opts.name},</p>
<p>Your attendance at the <strong>${opts.eventTitle}</strong> has been recorded,
and your certificate of participation is ready.</p>
<p><a href="${opts.siteUrl}/certificate" style="display:inline-block;background:#0B6E4F;color:#ffffff;padding:12px 22px;border-radius:4px;text-decoration:none">Download your certificate</a></p>
<p>You will be asked for your participation code:</p>
<p style="font-family:ui-monospace,monospace;font-size:22px;letter-spacing:4px;margin:16px 0">${opts.passcode}</p>
<p>The certificate carries ${opts.units} MCPD credit ${opts.units === 1 ? "unit" : "units"},
a serial number and a QR code, so anyone can confirm it is genuine. You can
download it again at any time.</p>`;

  return send(
    opts.to,
    `Your certificate is ready — ${opts.eventTitle}`,
    wrap(branch, body),
  );
}

/**
 * The password reset link.
 *
 * No branding flourish and no marketing: this is the email that gets somebody
 * back into the dashboard, and the plainer it is the more likely it lands in
 * an inbox rather than a spam folder.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  url: string;
  minutes: number;
}) {
  const branch = await getBranch();
  const body = `
<p>Dear ${opts.name},</p>
<p>Someone asked to reset the password for your ${branch.branchName} dashboard
account. Use the link below to set a new one.</p>
<p><a href="${opts.url}" style="display:inline-block;background:#0B6E4F;color:#ffffff;padding:12px 22px;border-radius:4px;text-decoration:none">Set a new password</a></p>
<p>The link works once and expires in ${opts.minutes} minutes.</p>
<p>If you did not ask for this, nothing has changed and you can ignore this
message — but tell the branch administrator, because it means somebody entered
your address on the sign-in page.</p>
<p style="font-size:13px;color:#5C6660">If the button does not work, copy this
address into your browser:<br>${opts.url}</p>`;

  return send(opts.to, `Reset your ${branch.branchName} dashboard password`, wrap(branch, body));
}

export async function sendRejectedEmail(opts: {
  to: string; name: string; eventTitle: string; reason: string;
}) {
  const branch = await getBranch();
  const body = `
<p>Dear ${opts.name},</p>
<p>We could not confirm your payment for the <strong>${opts.eventTitle}</strong>.</p>
<p style="background:#F7F8F6;border-left:2px solid #B08A2E;padding:12px 16px">${opts.reason}</p>
<p>Your registration is held, not cancelled. Contact the branch to resolve
this and your code will be issued once the payment is confirmed.</p>
${branch.contactPhones.length ? `<p><strong>${branch.contactPhones.join(" · ")}</strong>${branch.contactEmail ? `<br>${branch.contactEmail}` : ""}</p>` : ""}`;
  return send(opts.to, `Payment could not be confirmed — ${opts.eventTitle}`, wrap(branch, body));
}