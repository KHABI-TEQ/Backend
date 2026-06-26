import cloudinary from "../common/cloudinary";
import { isLikelyE164CapableLocalPhone } from "./whatsappClient.service";
import { getWhatsappSessionMessaging } from "./whatsapp/whatsappSessionMessaging.service";
import { getWhatsAppServiceIfConfigured } from "./whatsappClient.service";
import {
  buildTransactionVoiceScript,
  isTtsConfigured,
  synthesizeSpeech,
} from "./tts.service";
import type { ChannelLanguage } from "../config/channelAccess.config";

export interface TransactionVoiceNoteInput {
  phone: string;
  propertyLabel?: string;
  language?: ChannelLanguage;
  event?: "confirmation_request" | "confirmed" | "fee_paid";
}

async function uploadAudioToCloudinary(buffer: Buffer, phone: string): Promise<string | null> {
  try {
    const base64 = `data:audio/mpeg;base64,${buffer.toString("base64")}`;
    const publicId = `voice-${Date.now()}-${phone.slice(-6)}`;
    const url = await cloudinary.uploadFile(base64, publicId, "whatsapp-voice-notes");
    return url;
  } catch (err) {
    console.warn("[VoiceNote] Cloudinary upload failed:", err);
    return null;
  }
}

async function sendWhatsAppAudio(phone: string, audioUrl: string, caption?: string): Promise<boolean> {
  const sessionWa = getWhatsappSessionMessaging();
  if (sessionWa) {
    const result = await sessionWa.sendAudio(phone, audioUrl);
    if (result.success) return true;
  }

  const wa = getWhatsAppServiceIfConfigured();
  if (!wa) return false;

  const result = await wa.sendMediaMessage(phone, "audio", audioUrl, caption || "");
  return result.success;
}

/**
 * Generate Pidgin (or configured language) TTS and deliver as WhatsApp voice note.
 */
export async function sendTransactionVoiceNote(input: TransactionVoiceNoteInput): Promise<boolean> {
  const phone = String(input.phone || "").replace(/\s/g, "");
  if (!isLikelyE164CapableLocalPhone(phone)) {
    return false;
  }

  if (!isTtsConfigured()) {
    console.warn("[VoiceNote] TTS not configured — skipping voice note");
    return false;
  }

  const script = buildTransactionVoiceScript({
    propertyLabel: input.propertyLabel,
    language: input.language || "pcm",
    event: input.event,
  });

  const tts = await synthesizeSpeech(script);
  if (!tts.success || !tts.audioBuffer) {
    console.warn("[VoiceNote] TTS failed:", tts.error);
    return false;
  }

  const audioUrl = await uploadAudioToCloudinary(tts.audioBuffer, phone);
  if (!audioUrl) {
    return false;
  }

  return sendWhatsAppAudio(phone, audioUrl);
}
