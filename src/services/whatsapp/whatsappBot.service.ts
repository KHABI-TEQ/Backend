import { DB } from "../../controllers";
import { getChannelCopy } from "../../config/channelAccess.config";
import {
  buildSmsReceiptBody,
  verifyAgentByPhone,
  verifyPropertyByKeyword,
} from "../lasreraSelfService.service";
import { notifyAllActiveAdmins } from "../adminNotification.service";
import { sendSms } from "../sms.service";
import { getWhatsappSessionLanguage, saveWhatsappLanguageByButton } from "../channelLanguage.service";
import { initializeChannelRegistrationFeePayment } from "../channelPayment.service";
import { sendTransactionVoiceNote } from "../voiceNote.service";
import {
  appendWhatsappSupportMessage,
} from "./whatsappSupport.service";
import {
  getWhatsappSessionMessaging,
  WhatsappSessionMessagingService,
} from "./whatsappSessionMessaging.service";
import type { ChannelSessionStep } from "../../models/channelSession";

const SESSION_TTL_MS = Number(process.env.WHATSAPP_BOT_SESSION_TTL_MS || 86_400_000);
const HELP_KEYWORDS = ["help", "human", "agent", "support", "talk to human"];

export interface InboundWhatsAppMessage {
  from: string;
  messageId: string;
  type: string;
  text?: string;
  buttonId?: string;
  buttonTitle?: string;
}

async function getOrCreateSession(phone: string) {
  const sessionId = `wa:${phone}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  let session = await DB.Models.ChannelSession.findOne({
    channel: "whatsapp",
    sessionId,
  });

  if (!session || session.expiresAt < new Date()) {
    session = await DB.Models.ChannelSession.findOneAndUpdate(
      { channel: "whatsapp", sessionId },
      {
        channel: "whatsapp",
        sessionId,
        phoneNumber: phone,
        step: "language_select",
        context: { messages: [] },
        expiresAt,
      },
      { upsert: true, new: true }
    );
  }

  return session!;
}

async function updateSession(
  phone: string,
  step: ChannelSessionStep,
  contextFields: Record<string, unknown> = {}
) {
  const sessionId = `wa:${phone}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const setPayload: Record<string, unknown> = { step, expiresAt };
  for (const [key, value] of Object.entries(contextFields)) {
    setPayload[key] = value;
  }
  await DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "whatsapp", sessionId },
    { $set: setPayload },
    { upsert: true }
  );
}

async function sendMainMenu(wa: WhatsappSessionMessagingService, phone: string) {
  const lang = await getWhatsappSessionLanguage(phone);
  const copy = getChannelCopy(lang);
  await updateSession(phone, "main");
  await wa.sendButtons(
    phone,
    `${copy.welcome}\nTap an option:`,
    [
      { id: "verify_agent", title: "Verify Agent" },
      { id: "verify_property", title: "Verify Property" },
      { id: "pay_fee", title: "Pay Fee" },
    ]
  );
  await wa.sendButtons(phone, "More options:", [
    { id: "set_language", title: "Language" },
    { id: "talk_human", title: "Talk to Human" },
  ]);
}

async function sendLanguageMenu(wa: WhatsappSessionMessagingService, phone: string) {
  const copy = getChannelCopy();
  await updateSession(phone, "language_select");
  await wa.sendButtons(phone, copy.languageMenu.replace(/\n/g, " "), [
    { id: "lang_en", title: "English" },
    { id: "lang_pcm", title: "Pidgin" },
    { id: "lang_yo", title: "Yoruba" },
  ]);
  await wa.sendButtons(phone, "More languages:", [
    { id: "lang_ig", title: "Igbo" },
    { id: "lang_ha", title: "Hausa" },
  ]);
}

async function routeHumanHandoff(phone: string, reason: string) {
  await updateSession(phone, "awaiting_human", { "context.reason": reason });
  await notifyAllActiveAdmins({
    title: "WhatsApp support requested",
    message: `User ${phone} requested human assistance via WhatsApp bot.`,
    type: "general",
    meta: { channel: "whatsapp", phone, reason },
  });
}

function isHelpIntent(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return HELP_KEYWORDS.some((k) => normalized === k || normalized.includes(k));
}

const LANG_BUTTON_MAP: Record<string, string> = {
  lang_en: "1",
  lang_pcm: "2",
  lang_yo: "3",
  lang_ig: "4",
  lang_ha: "5",
};

export async function handleInboundWhatsAppMessage(msg: InboundWhatsAppMessage): Promise<void> {
  const wa = getWhatsappSessionMessaging();
  if (!wa) {
    console.warn("[WhatsApp Bot] Not configured — skipping inbound message");
    return;
  }

  const phone = msg.from;
  const session = await getOrCreateSession(phone);
  const step = session.step as ChannelSessionStep;
  const text = (msg.text || msg.buttonTitle || "").trim();
  const buttonId = msg.buttonId;
  const lang = await getWhatsappSessionLanguage(phone);
  const copy = getChannelCopy(lang);

  if (text || buttonId) {
    await appendWhatsappSupportMessage(phone, {
      direction: "inbound",
      body: text || buttonId || "",
      at: new Date().toISOString(),
    });
  }

  if (buttonId && LANG_BUTTON_MAP[buttonId]) {
    await saveWhatsappLanguageByButton(phone, buttonId);
    await sendMainMenu(wa, phone);
    return;
  }

  if (buttonId === "set_language" || step === "language_select") {
    if (buttonId === "set_language") {
      await sendLanguageMenu(wa, phone);
      return;
    }
  }

  if (isHelpIntent(text) || buttonId === "talk_human") {
    await routeHumanHandoff(phone, text || buttonId || "help");
    await wa.sendText(phone, copy.humanHandoff);
    return;
  }

  if (buttonId === "verify_agent" || text.toLowerCase() === "1") {
    await updateSession(phone, "verify_agent_input");
    await wa.sendText(phone, copy.verifyAgentPrompt);
    return;
  }
  if (buttonId === "verify_property" || text.toLowerCase() === "2") {
    await updateSession(phone, "verify_property_input");
    await wa.sendText(phone, copy.verifyPropertyPrompt);
    return;
  }

  if (buttonId === "pay_fee" || text.toLowerCase() === "3") {
    await updateSession(phone, "pay_fee_select");
    await wa.sendButtons(phone, copy.payFeeMenu.replace(/\n/g, " "), [
      { id: "fee_1", title: "Rental N5k" },
      { id: "fee_2", title: "Sale N15k" },
      { id: "fee_3", title: "Land N20k" },
    ]);
    return;
  }

  if (buttonId?.startsWith("fee_")) {
    const choice = buttonId.replace("fee_", "");
    const payment = await initializeChannelRegistrationFeePayment(phone, choice, "whatsapp");
    if (!payment.success) {
      await wa.sendText(phone, payment.error || "Payment could not be started.");
      return;
    }
    await updateSession(phone, "pay_fee_pending", {
      "context.paymentReference": payment.reference,
    });
    const dial = payment.ussdCode || payment.displayText || payment.reference;
    await wa.sendText(
      phone,
      `${copy.payFeeDialPrompt}\n${dial}\nRef: ${payment.reference}\nAmount: N${payment.amountNaira}`
    );
    return;
  }

  if (buttonId === "sms_yes") {
    const detail = String(session.context?.detail || "");
    const kind = (session.context?.kind as "agent" | "property") || "agent";
    if (detail) {
      const sms = await sendSms(phone, buildSmsReceiptBody(kind, detail, phone));
      await wa.sendText(phone, sms.success ? "SMS receipt sent." : "SMS could not be sent right now.");
    }
    await sendMainMenu(wa, phone);
    return;
  }
  if (buttonId === "sms_no" || buttonId === "main_menu") {
    await sendMainMenu(wa, phone);
    return;
  }

  if (step === "verify_agent_input" && text) {
    const result = await verifyAgentByPhone(text);
    await updateSession(phone, "verify_agent_result", {
      "context.kind": "agent",
      "context.detail": result.summary,
      "context.inputPhone": text,
    });
    await wa.sendText(phone, result.summary);
    await wa.sendButtons(phone, copy.smsReceiptPrompt.replace(/\n/g, " "), [
      { id: "sms_yes", title: "Yes, send SMS" },
      { id: "sms_no", title: "No thanks" },
    ]);
    return;
  }

  if (step === "verify_property_input" && text) {
    const result = await verifyPropertyByKeyword(text);
    const line =
      result.matches[0]?.address != null
        ? `${result.summary}\n${result.matches[0].address}`
        : result.summary;
    await updateSession(phone, "verify_property_result", {
      "context.kind": "property",
      "context.detail": line,
      "context.keyword": text,
    });
    await wa.sendText(phone, line);
    await wa.sendButtons(phone, copy.smsReceiptPrompt.replace(/\n/g, " "), [
      { id: "sms_yes", title: "Yes, send SMS" },
      { id: "sms_no", title: "No thanks" },
    ]);
    return;
  }

  if (step === "awaiting_human") {
    await wa.sendText(phone, copy.awaitingHuman);
    return;
  }

  if (step === "language_select" && !session.language) {
    await sendLanguageMenu(wa, phone);
    return;
  }

  await sendMainMenu(wa, phone);
}

/** Voice note after transaction confirmation request (called from cron). */
export async function sendTransactionConfirmationVoiceNote(
  phone: string,
  propertyLabel: string
): Promise<void> {
  void sendTransactionVoiceNote({
    phone,
    propertyLabel,
    language: "pcm",
    event: "confirmation_request",
  });
}
