import { DB } from "../controllers";
import { ChannelLanguage, parseLanguageChoice } from "../config/channelAccess.config";

export function resolveDefaultLanguage(): ChannelLanguage {
  const raw = (process.env.CHANNEL_DEFAULT_LANGUAGE || "en").toLowerCase();
  if (raw === "pcm" || raw === "yo" || raw === "ig" || raw === "ha") return raw;
  return "en";
}

export async function getUssdSessionLanguage(
  sessionId: string,
  phoneNumber: string
): Promise<ChannelLanguage | null> {
  const session = await DB.Models.ChannelSession.findOne({
    channel: "ussd",
    sessionId,
  })
    .select("language")
    .lean();

  if (session?.language) {
    return session.language as ChannelLanguage;
  }

  const prior = await DB.Models.ChannelSession.findOne({
    channel: "ussd",
    phoneNumber,
    language: { $exists: true, $ne: null },
  })
    .sort({ updatedAt: -1 })
    .select("language")
    .lean();

  return (prior?.language as ChannelLanguage) || null;
}

export async function saveUssdLanguage(
  sessionId: string,
  phoneNumber: string,
  choice: string
): Promise<ChannelLanguage | null> {
  const lang = parseLanguageChoice(choice);
  if (!lang) return null;

  await DB.Models.ChannelSession.updateMany(
    { channel: "ussd", phoneNumber },
    { $set: { language: lang } }
  );

  await DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "ussd", sessionId },
    { $set: { language: lang } }
  );

  return lang;
}

export async function getWhatsappSessionLanguage(phone: string): Promise<ChannelLanguage> {
  const session = await DB.Models.ChannelSession.findOne({
    channel: "whatsapp",
    sessionId: `wa:${phone}`,
  })
    .select("language")
    .lean();

  const lang = session?.language as ChannelLanguage | undefined;
  if (lang && ["en", "pcm", "yo", "ig", "ha"].includes(lang)) {
    return lang;
  }
  return resolveDefaultLanguage();
}

const LANG_BUTTON_TO_CODE: Record<string, ChannelLanguage> = {
  lang_en: "en",
  lang_pcm: "pcm",
  lang_yo: "yo",
  lang_ig: "ig",
  lang_ha: "ha",
};

export async function saveWhatsappLanguageByButton(
  phone: string,
  buttonId: string
): Promise<ChannelLanguage | null> {
  const lang = LANG_BUTTON_TO_CODE[buttonId];
  if (!lang) return null;

  await DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "whatsapp", sessionId: `wa:${phone}` },
    { $set: { language: lang } }
  );
  return lang;
}

export async function saveWhatsappLanguage(phone: string, choice: string): Promise<ChannelLanguage | null> {
  const lang = parseLanguageChoice(choice);
  if (!lang) return null;

  await DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "whatsapp", sessionId: `wa:${phone}` },
    { $set: { language: lang } }
  );
  return lang;
}
