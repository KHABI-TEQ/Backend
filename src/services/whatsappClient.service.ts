import WhatsAppNotificationService from "./whatsAppNotification.service";

/**
 * Returns a ready {@link WhatsAppNotificationService} when access token and phone
 * number id are set; otherwise null (no throw — callers can skip).
 */
export function getWhatsAppServiceIfConfigured(): WhatsAppNotificationService | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return null;
  }
  return new WhatsAppNotificationService({ accessToken, phoneNumberId });
}

/** Minimum length after stripping spaces; aligns with userProvisioningNotifications. */
export function isLikelyE164CapableLocalPhone(phone: string | undefined | null): boolean {
  return String(phone || "").replace(/\s/g, "").length >= 10;
}

export async function runWhatsapp(
  name: string,
  fn: (wa: WhatsAppNotificationService) => Promise<unknown>
): Promise<void> {
  const wa = getWhatsAppServiceIfConfigured();
  if (!wa) {
    return;
  }
  try {
    await fn(wa);
  } catch (e) {
    console.warn(`[WhatsApp] ${name} failed:`, e);
  }
}
