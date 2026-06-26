import axios, { AxiosResponse } from "axios";
import { normalizeNigerianPhone } from "../../common/phoneUtils";

export interface WhatsAppButton {
  id: string;
  title: string;
}

export interface SessionMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id: string }>;
  error?: { message?: string };
}

/**
 * Session messages (text + interactive buttons) for the guided self-service bot.
 * These work inside the 24-hour customer service window — not template messages.
 */
export class WhatsappSessionMessagingService {
  private whatsappApiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.whatsappApiUrl = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v22.0";
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  }

  isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }

  private formatPhone(phone: string): string {
    const normalized = normalizeNigerianPhone(phone);
    if (!normalized) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
    return normalized;
  }

  private async post(payload: Record<string, unknown>): Promise<SessionMessageResult> {
    if (!this.isConfigured()) {
      return { success: false, error: "WhatsApp not configured" };
    }

    try {
      const response: AxiosResponse<WhatsAppApiResponse> = await axios.post(
        `${this.whatsappApiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
      };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Send failed";
      console.warn("[WhatsApp Bot] Send error:", msg);
      return { success: false, error: msg };
    }
  }

  async sendText(to: string, body: string): Promise<SessionMessageResult> {
    return this.post({
      messaging_product: "whatsapp",
      to: this.formatPhone(to),
      type: "text",
      text: { body },
    });
  }

  async sendButtons(to: string, body: string, buttons: WhatsAppButton[]): Promise<SessionMessageResult> {
    const trimmed = buttons.slice(0, 3).map((b) => ({
      type: "reply" as const,
      reply: {
        id: b.id.slice(0, 256),
        title: b.title.slice(0, 20),
      },
    }));

    return this.post({
      messaging_product: "whatsapp",
      to: this.formatPhone(to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body.slice(0, 1024) },
        action: { buttons: trimmed },
      },
    });
  }

  async sendAudio(to: string, audioUrl: string): Promise<SessionMessageResult> {
    return this.post({
      messaging_product: "whatsapp",
      to: this.formatPhone(to),
      type: "audio",
      audio: { link: audioUrl },
    });
  }
}

let instance: WhatsappSessionMessagingService | null = null;

export function getWhatsappSessionMessaging(): WhatsappSessionMessagingService | null {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return null;
  }
  if (!instance) {
    instance = new WhatsappSessionMessagingService();
  }
  return instance;
}
