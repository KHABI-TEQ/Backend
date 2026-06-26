import { DB } from "../../controllers";
import {
  ChannelLanguage,
  getChannelCopy,
  getFeeSummaryLines,
  parseLanguageChoice,
  USSD_MAX_RESPONSE_CHARS,
} from "../../config/channelAccess.config";
import {
  buildSmsReceiptBody,
  verifyAgentByPhone,
  verifyPropertyByKeyword,
} from "../lasreraSelfService.service";
import { sendSms } from "../sms.service";
import { getUssdSessionLanguage, saveUssdLanguage } from "../channelLanguage.service";
import { initializeChannelRegistrationFeePayment } from "../channelPayment.service";
import {
  NormalizedUssdRequest,
  splitUssdInput,
  UssdResponse,
} from "./ussdProvider.service";

const SESSION_TTL_MS = Number(process.env.USSD_SESSION_TTL_MS || 120_000);

function truncateUssd(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= USSD_MAX_RESPONSE_CHARS) return clean;
  return `${clean.slice(0, USSD_MAX_RESPONSE_CHARS - 3)}...`;
}

function con(message: string): UssdResponse {
  return { type: "CON", message: truncateUssd(message) };
}

function end(message: string): UssdResponse {
  return { type: "END", message: truncateUssd(message) };
}

async function loadSession(req: NormalizedUssdRequest) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  return DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "ussd", sessionId: req.sessionId },
    {
      channel: "ussd",
      sessionId: req.sessionId,
      phoneNumber: req.phoneNumber,
      expiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function setSessionState(
  sessionId: string,
  step: string,
  patch: { language?: string; context?: Record<string, unknown> } = {}
) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const update: Record<string, unknown> = { step, expiresAt };
  if (patch.language) update.language = patch.language;
  if (patch.context) update.context = patch.context;

  await DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "ussd", sessionId },
    { $set: update },
    { upsert: false }
  );
}

function actionParts(parts: string[], hasLangPrefix: boolean): string[] {
  if (!hasLangPrefix) return parts;
  return parts.slice(1);
}

export async function handleUssdSession(req: NormalizedUssdRequest): Promise<UssdResponse> {
  const parts = splitUssdInput(req.text);
  const session = await loadSession(req);
  const storedLang = (session?.language as ChannelLanguage) || (await getUssdSessionLanguage(req.sessionId, req.phoneNumber));
  const lang = storedLang || null;
  const copy = getChannelCopy(lang || undefined);

  const langFromText = parts.length > 0 ? parseLanguageChoice(parts[0]) : null;
  const hasLangInText = !!langFromText && !lang;
  const effectiveLang = lang || langFromText || ("en" as ChannelLanguage);
  const effectiveCopy = getChannelCopy(effectiveLang);
  const actions = actionParts(parts, hasLangInText);

  // First screen — language if not set
  if (!lang && parts.length === 0) {
    await setSessionState(req.sessionId, "language_select");
    return con(effectiveCopy.languageMenu);
  }

  if (!lang && parts.length === 1 && langFromText) {
    await saveUssdLanguage(req.sessionId, req.phoneNumber, parts[0]);
    await setSessionState(req.sessionId, "main", { language: langFromText });
    return con(`${getChannelCopy(langFromText).welcome}\n${getChannelCopy(langFromText).mainMenu}`);
  }

  // depth 0 with language set — main menu
  if (parts.length === 0) {
    await setSessionState(req.sessionId, "main");
    return con(`${copy.welcome}\n${copy.mainMenu}`);
  }

  const menuChoice = actions[0];

  if (menuChoice === "9") {
    await setSessionState(req.sessionId, "language_select");
    return con(effectiveCopy.languageMenu);
  }

  // Option 3 — pay registration fee via Paystack USSD
  if (menuChoice === "3") {
    if (actions.length === 1) {
      await setSessionState(req.sessionId, "pay_fee_select");
      return con(effectiveCopy.payFeeMenu);
    }

    const feeChoice = actions[1];
    const payment = await initializeChannelRegistrationFeePayment(req.phoneNumber, feeChoice, "ussd");
    if (!payment.success) {
      return end(payment.error || "Payment unavailable. Try again later.");
    }

    await setSessionState(req.sessionId, "pay_fee_pending", {
      context: {
        reference: payment.reference,
        amountNaira: payment.amountNaira,
      },
    });

    const dial = payment.ussdCode || payment.displayText || payment.reference;
    return end(
      `${effectiveCopy.payFeeDialPrompt}\n${dial}\nRef: ${payment.reference}\nAmt: N${payment.amountNaira}`
    );
  }

  // Option 1 — verify agent
  if (menuChoice === "1") {
    if (actions.length === 1) {
      await setSessionState(req.sessionId, "verify_agent_input");
      return con(effectiveCopy.verifyAgentPrompt);
    }

    const phoneInput = actions[1];
    if (actions.length === 2) {
      const result = await verifyAgentByPhone(phoneInput);
      await setSessionState(req.sessionId, "verify_agent_result", {
        context: { kind: "agent", detail: result.summary, inputPhone: phoneInput },
      });
      return con(`${result.summary}\n${effectiveCopy.smsReceiptPrompt}`);
    }

    if (actions.length === 3) {
      const detail = String(session?.context?.detail || "");
      const inputPhone = String(session?.context?.inputPhone || req.phoneNumber);
      if (actions[2] === "1" && detail) {
        const sms = await sendSms(req.phoneNumber, buildSmsReceiptBody("agent", detail, inputPhone));
        const suffix = sms.success ? "SMS sent." : "SMS unavailable.";
        return end(`${detail}\n${suffix}`);
      }
      return end(detail || "Thank you.");
    }
  }

  // Option 2 — verify property
  if (menuChoice === "2") {
    if (actions.length === 1) {
      await setSessionState(req.sessionId, "verify_property_input");
      return con(effectiveCopy.verifyPropertyPrompt);
    }

    const keyword = actions[1];
    if (actions.length === 2) {
      const result = await verifyPropertyByKeyword(keyword);
      const line =
        result.matches[0]?.address != null
          ? `${result.summary}\n${result.matches[0].address}`
          : result.summary;
      await setSessionState(req.sessionId, "verify_property_result", {
        context: { kind: "property", detail: line, keyword },
      });
      return con(`${line}\n${effectiveCopy.smsReceiptPrompt}`);
    }

    if (actions.length === 3) {
      const detail = String(session?.context?.detail || "");
      if (actions[2] === "1" && detail) {
        const sms = await sendSms(req.phoneNumber, buildSmsReceiptBody("property", detail, req.phoneNumber));
        const suffix = sms.success ? "SMS sent." : "SMS unavailable.";
        return end(`${detail}\n${suffix}`);
      }
      return end(detail || "Thank you.");
    }
  }

  return end(copy.invalidChoice);
}

export function getUssdServiceInfo(): Record<string, unknown> {
  return {
    provider: process.env.USSD_PROVIDER || "generic",
    serviceCode: process.env.USSD_SERVICE_CODE || null,
    feeSummary: getFeeSummaryLines(),
    smsConfigured: process.env.SMS_PROVIDER || "none",
    ttsConfigured: process.env.TTS_PROVIDER || "none",
    paystackUssdBank: process.env.PAYSTACK_USSD_BANK_CODE || "737",
  };
}
