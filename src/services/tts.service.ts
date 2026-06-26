import axios from "axios";
import type { ChannelLanguage } from "../config/channelAccess.config";

export type TtsProvider = "elevenlabs" | "polly" | "none";

export interface TtsSynthesisResult {
  success: boolean;
  audioBuffer?: Buffer;
  contentType?: string;
  provider: TtsProvider;
  error?: string;
}

function getTtsProvider(): TtsProvider {
  const raw = (process.env.TTS_PROVIDER || "none").trim().toLowerCase();
  if (raw === "elevenlabs" || raw === "polly") return raw;
  return "none";
}

export function isTtsConfigured(): boolean {
  const provider = getTtsProvider();
  if (provider === "elevenlabs") {
    return !!process.env.ELEVENLABS_API_KEY;
  }
  if (provider === "polly") {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  }
  return false;
}

async function synthesizeElevenLabs(text: string): Promise<TtsSynthesisResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: modelId,
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
      timeout: 30000,
    }
  );

  return {
    success: true,
    audioBuffer: Buffer.from(response.data),
    contentType: "audio/mpeg",
    provider: "elevenlabs",
  };
}

async function synthesizePolly(text: string): Promise<TtsSynthesisResult> {
  const region = process.env.AWS_REGION || "eu-west-1";
  const voiceId = process.env.POLLY_VOICE_ID || "Joanna";
  const engine = process.env.POLLY_ENGINE || "neural";

  const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly");

  const client = new PollyClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const output = await client.send(
    new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: voiceId as any,
      Engine: engine as any,
    })
  );

  const bytes = await output.AudioStream?.transformToByteArray();
  if (!bytes?.length) {
    return { success: false, provider: "polly", error: "Empty Polly audio stream" };
  }

  return {
    success: true,
    audioBuffer: Buffer.from(bytes),
    contentType: "audio/mpeg",
    provider: "polly",
  };
}

export async function synthesizeSpeech(text: string): Promise<TtsSynthesisResult> {
  const provider = getTtsProvider();
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    return { success: false, provider, error: "Empty text" };
  }

  if (provider === "none" || !isTtsConfigured()) {
    return { success: false, provider: "none", error: "TTS not configured" };
  }

  try {
    if (provider === "elevenlabs") {
      return await synthesizeElevenLabs(trimmed);
    }
    return await synthesizePolly(trimmed);
  } catch (err: any) {
    console.warn("[TTS] Synthesis failed:", err?.message || err);
    return {
      success: false,
      provider,
      error: err?.message || "TTS synthesis failed",
    };
  }
}

export function buildTransactionVoiceScript(opts: {
  propertyLabel?: string;
  language?: ChannelLanguage;
  event?: "confirmation_request" | "confirmed" | "fee_paid";
}): string {
  const property = opts.propertyLabel || "your property";
  const lang = opts.language || "pcm";

  const scripts: Record<string, Record<string, string>> = {
    pcm: {
      confirmation_request: `Oga, you don inspect ${property} finish. Abeg confirm whether transaction don happen. Check WhatsApp for the button to confirm.`,
      confirmed: `Oga, we don record say your transaction for ${property} don complete. Register am on LASRERA-KHABITEQ so everything go set. No wahala.`,
      fee_paid: `Oga, your registration fee don pay finish. Everything don set. Thank you for using LASRERA-KHABITEQ.`,
    },
    en: {
      confirmation_request: `Your inspection for ${property} is complete. Please confirm if your transaction took place using the link we sent you.`,
      confirmed: `We have recorded your transaction for ${property}. Please register it on LASRERA-KHABITEQ to complete compliance.`,
      fee_paid: `Your registration fee payment was successful. Thank you for using LASRERA-KHABITEQ.`,
    },
    yo: {
      confirmation_request: `Ẹ ti ṣayẹwo ${property}. Jọwọ jẹrisi boya idunadura ti waye.`,
      confirmed: `A ti ṣe igbasilẹ idunadura rẹ fun ${property}. Jọwọ forukọsilẹ lori LASRERA-KHABITEQ.`,
      fee_paid: `Owo igbasilẹ rẹ ti san dada. E dupe.`,
    },
    ig: {
      confirmation_request: `Ị nyochala ${property}. Biko kwado ma ọrụ gbanwere mere.`,
      confirmed: `Anyị edebanyela gị na ndekọ maka ${property}. Biko debanye na LASRERA-KHABITEQ.`,
      fee_paid: `Ị kwụọla ụgwọ ndebanye aha nke ọma. Daalụ.`,
    },
    ha: {
      confirmation_request: `Kun duba ${property}. Don Allah tabbatar ciniki ya faru.`,
      confirmed: `Mun rubuta cinikin ku na ${property}. Don Allah yi rajista a LASRERA-KHABITEQ.`,
      fee_paid: `An biya kuɗin rajista cikin nasara. Na gode.`,
    },
  };

  const event = opts.event || "confirmation_request";
  return scripts[lang]?.[event] || scripts.pcm[event] || scripts.en[event];
}
