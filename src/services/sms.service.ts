import axios from "axios";
import { normalizeNigerianPhone } from "../common/phoneUtils";

export type SmsProvider = "termii" | "africastalking" | "none";

export interface SmsSendResult {
  success: boolean;
  provider: SmsProvider;
  messageId?: string;
  error?: string;
}

function getSmsProvider(): SmsProvider {
  const raw = (process.env.SMS_PROVIDER || "none").trim().toLowerCase();
  if (raw === "termii" || raw === "africastalking") return raw;
  return "none";
}

export function isSmsConfigured(): boolean {
  const provider = getSmsProvider();
  if (provider === "termii") {
    return !!(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID);
  }
  if (provider === "africastalking") {
    return !!(
      process.env.AFRICASTALKING_API_KEY &&
      process.env.AFRICASTALKING_USERNAME &&
      process.env.AFRICASTALKING_SMS_SENDER_ID
    );
  }
  return false;
}

async function sendViaTermii(to: string, message: string): Promise<SmsSendResult> {
  const apiKey = process.env.TERMII_API_KEY!;
  const senderId = process.env.TERMII_SENDER_ID!;
  const channel = process.env.TERMII_SMS_CHANNEL || "generic";

  const response = await axios.post(
    "https://api.ng.termii.com/api/sms/send",
    {
      api_key: apiKey,
      to,
      from: senderId,
      sms: message,
      type: "plain",
      channel,
    },
    { timeout: 15000 }
  );

  return {
    success: true,
    provider: "termii",
    messageId: response.data?.message_id || response.data?.messageId,
  };
}

async function sendViaAfricasTalking(to: string, message: string): Promise<SmsSendResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY!;
  const username = process.env.AFRICASTALKING_USERNAME!;
  const from = process.env.AFRICASTALKING_SMS_SENDER_ID!;

  const body = new URLSearchParams({
    username,
    to: `+${to}`,
    message,
    from,
  });

  const response = await axios.post("https://api.africastalking.com/version1/messaging", body.toString(), {
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    timeout: 15000,
  });

  const recipients = response.data?.SMSMessageData?.Recipients;
  const first = Array.isArray(recipients) ? recipients[0] : null;

  return {
    success: String(first?.status || "").toLowerCase() === "success",
    provider: "africastalking",
    messageId: first?.messageId,
    error: first?.status !== "Success" ? String(first?.status || "failed") : undefined,
  };
}

/** Fire-and-forget friendly SMS sender for USSD receipts and confirmations. */
export async function sendSms(phone: string, message: string): Promise<SmsSendResult> {
  const provider = getSmsProvider();
  const normalized = normalizeNigerianPhone(phone);

  if (!normalized) {
    return { success: false, provider, error: "Invalid phone number" };
  }

  if (provider === "none" || !isSmsConfigured()) {
    console.warn("[SMS] Provider not configured — skipping send to", normalized);
    return { success: false, provider: "none", error: "SMS provider not configured" };
  }

  try {
    if (provider === "termii") {
      return await sendViaTermii(normalized, message);
    }
    return await sendViaAfricasTalking(normalized, message);
  } catch (err: any) {
    console.warn("[SMS] Send failed:", err?.message || err);
    return {
      success: false,
      provider,
      error: err?.message || "SMS send failed",
    };
  }
}
