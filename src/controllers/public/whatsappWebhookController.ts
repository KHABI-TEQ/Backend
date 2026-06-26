/** @format */

import { Request, Response } from "express";
import { handleInboundWhatsAppMessage } from "../../services/whatsapp/whatsappBot.service";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

interface WhatsAppInteractiveButtonReply {
  id: string;
  title: string;
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type?: string;
  text?: { body: string };
  interactive?: {
    type?: string;
    button_reply?: WhatsAppInteractiveButtonReply;
    list_reply?: { id: string; title: string };
  };
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
 * Verify webhook (GET) — Meta calls this once when you set up the webhook
 */
export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.error("Webhook verification failed");
    res.sendStatus(403);
  }
};

function parseInboundMessage(msg: WhatsAppMessage) {
  const type = msg.type || "unknown";
  let text: string | undefined;
  let buttonId: string | undefined;
  let buttonTitle: string | undefined;

  if (type === "text" && msg.text?.body) {
    text = msg.text.body;
  } else if (type === "interactive" && msg.interactive) {
    if (msg.interactive.button_reply) {
      buttonId = msg.interactive.button_reply.id;
      buttonTitle = msg.interactive.button_reply.title;
      text = buttonTitle;
    } else if (msg.interactive.list_reply) {
      buttonId = msg.interactive.list_reply.id;
      buttonTitle = msg.interactive.list_reply.title;
      text = buttonTitle;
    }
  }

  return {
    from: msg.from,
    messageId: msg.id,
    type,
    text,
    buttonId,
    buttonTitle,
  };
}

/**
 * Handle webhook events (POST) — routes inbound messages to the guided self-service bot
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as WhatsAppWebhookBody;

    if (body.object !== "whatsapp_business_account") {
      res.sendStatus(404);
      return;
    }

    // Acknowledge immediately — Meta expects a fast 200
    res.sendStatus(200);

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        if (value.messages) {
          for (const msg of value.messages) {
            const inbound = parseInboundMessage(msg);
            console.log(`[WhatsApp] Inbound from ${inbound.from}:`, inbound.text || inbound.type);

            void handleInboundWhatsAppMessage(inbound).catch((err) => {
              console.error("[WhatsApp Bot] Handler error:", err);
            });
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(
              `[WhatsApp] Message ${status.id} to ${status.recipient_id} -> ${status.status}`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
};

/**
 * Send a plain text WhatsApp message (legacy helper — prefer WhatsappSessionMessagingService)
 */
export const sendMessage = async (to: string, text: string): Promise<unknown> => {
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
  console.log("Message sent response:", data);
  return data;
};
