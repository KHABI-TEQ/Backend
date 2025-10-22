/** @format */

import { Request, Response } from "express";

// === CONFIG ===
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // same as your Meta Dashboard token
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // from your Meta app
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // your system user access token

// === Types ===
interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  type?: string;
}

interface WhatsAppStatus {
  id: string;
  recipient_id: string;
  status: string;
  timestamp: string;
}

interface WhatsAppChangeValue {
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppEntry {
  changes: { value: WhatsAppChangeValue }[];
}

interface WhatsAppWebhookBody {
  object: string;
  entry: WhatsAppEntry[];
}

/**
 * ✅ Verify webhook (GET)
 * Meta calls this once when you set up the webhook
 */
export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Webhook verification failed!");
    res.sendStatus(403);
  }
};

/**
 * 📩 Handle webhook events (POST)
 * WhatsApp will send messages and status updates here
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as WhatsAppWebhookBody;

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes ?? []) {
          const value = change.value;

          // 🟢 Incoming user messages
          if (value.messages) {
            for (const msg of value.messages) {
              const from = msg.from;
              const text = msg.text?.body || "(non-text message)";
              console.log(`📩 Message from ${from}: ${text}`);

              // Example: Auto reply
              await sendMessage(from, "Thanks for your message! ✅");
            }
          }

          // 🟣 Message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              console.log(
                `📬 Message ${status.id} to ${status.recipient_id} → ${status.status}`
              );
            }
          }
        }
      }

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error("❌ Webhook handling error:", err);
    res.sendStatus(500);
  }
};

/**
 * ✉️ Send a WhatsApp text message
 */
export const sendMessage = async (to: string, text: string): Promise<any> => {
  try {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("📤 Message sent response:", data);
    return data;
  } catch (error) {
    console.error("❌ Failed to send message:", error);
    throw error;
  }
};
