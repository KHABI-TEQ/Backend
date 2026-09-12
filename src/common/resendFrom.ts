/** Verified Resend sending domain. The apex khabiteq.com is not verified. */
const VERIFIED_RESEND_DOMAIN = "notification.khabiteq.com";
const DEFAULT_RESEND_LOCAL = "notifications";

/**
 * Build a Resend From header that always uses a verified sending domain.
 * Env values like notifications@khabiteq.com are rewritten because Resend
 * rejects that apex domain (403 validation_error).
 */
export function getResendFromAddress(): string {
  const name = process.env.FROM_NAME || "Khabiteq";
  const raw = (
    process.env.RESEND_FROM ||
    process.env.EMAIL_USER_FOR_RESEND ||
    `${DEFAULT_RESEND_LOCAL}@${VERIFIED_RESEND_DOMAIN}`
  ).trim();

  const angled = raw.match(/^(.*)<([^>]+)>\s*$/);
  const display = (angled ? angled[1] : "").trim() || name;
  let address = (angled ? angled[2] : raw).trim();

  const at = address.lastIndexOf("@");
  const local = at >= 0 ? address.slice(0, at) : DEFAULT_RESEND_LOCAL;
  const domain = at >= 0 ? address.slice(at + 1).toLowerCase() : "";

  if (domain === "khabiteq.com" || domain === "notifications.khabiteq.com") {
    address = `${local}@${VERIFIED_RESEND_DOMAIN}`;
  }

  return `${display} <${address}>`;
}
