import crypto from "crypto";
import axios from "axios";
import { DB } from "../controllers";

const GCM_ALGO = "aes-256-gcm";

function encKey(): Buffer {
  const raw = process.env.SYNDICATION_PENDING_CRED_KEY || process.env.SYNDICATION_WEBHOOK_SECRET || "khabiteq-syndication-pending";
  return crypto.createHash("sha256").update(String(raw), "utf8").digest();
}

export function encryptSyndicationPendingSecret(plaintext: string): { encBlob: string; encIv: string; encTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(GCM_ALGO, encKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encBlob: enc.toString("base64"),
    encIv: iv.toString("base64"),
    encTag: tag.toString("base64"),
  };
}

export function decryptSyndicationPendingSecret(encBlob: string, encIv: string, encTag: string): string {
  const decipher = crypto.createDecipheriv(GCM_ALGO, encKey(), Buffer.from(encIv, "base64"));
  decipher.setAuthTag(Buffer.from(encTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encBlob, "base64")), decipher.final()]).toString("utf8");
}

export async function postPartnerCredentialVerification(params: {
  loginUrl: string;
  correlationId: string;
  platformKey: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = String(params.loginUrl || "").trim().replace(/\/+$/, "");
  if (!url) return { ok: false, status: 0, data: { message: "Partner login URL is missing" } };
  try {
    const response = await axios.post(
      url,
      { email: params.email, password: params.password },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Khabiteq-Correlation-Id": params.correlationId,
          "X-Khabiteq-Platform-Key": params.platformKey,
        },
        timeout: Number(process.env.SYNDICATION_PARTNER_LOGIN_TIMEOUT_MS || 20000),
        validateStatus: () => true,
      }
    );
    const ok = response.status >= 200 && response.status < 300;
    return { ok, status: response.status, data: response.data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { message: e?.message || "Partner login request failed" } };
  }
}

/** Resolve partner login probe URL: optional full loginUrl, else syndication baseUrl. */
export function resolvePartnerSyndicationLoginUrl(platform: { config?: { baseUrl?: string; loginUrl?: string } }): string {
  const login = String(platform?.config?.loginUrl || "").trim();
  if (login) return login.replace(/\/+$/, "");
  return String(platform?.config?.baseUrl || "").trim().replace(/\/+$/, "");
}

export async function finalizeSyndicationConnectionFromPartnerAuthCallback(params: {
  correlationId: string;
  platformKey: string;
  email: string;
  success: boolean;
  verified: boolean;
  message?: string | null;
  externalUserId?: string | null;
}): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const correlationId = String(params.correlationId || "").trim();
  const platformKey = String(params.platformKey || "").trim().toLowerCase();
  const email = String(params.email || "").trim().toLowerCase();
  if (!correlationId || !platformKey || !email) {
    return { ok: false, error: "correlationId, platformKey and email are required" };
  }

  const pending = await DB.Models.SyndicationConnectionVerification.findOne({
    correlationId,
    status: "pending",
  }).lean();

  if (!pending) {
    return { ok: false, error: "Verification session not found or already completed" };
  }

  if (String(pending.platformKey).toLowerCase() !== platformKey) {
    return { ok: false, error: "platformKey does not match verification session" };
  }
  if (String(pending.email).toLowerCase() !== email) {
    return { ok: false, error: "email does not match verification session" };
  }

  if (!params.success) {
    await DB.Models.SyndicationConnectionVerification.updateOne(
      { _id: pending._id },
      {
        $set: {
          status: "failed",
          partnerMessage: params.message ? String(params.message).slice(0, 500) : "Partner reported success=false",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        $unset: { encBlob: "", encIv: "", encTag: "" },
      }
    );
    return { ok: true };
  }

  if (!params.verified) {
    await DB.Models.SyndicationConnectionVerification.updateOne(
      { _id: pending._id },
      {
        $set: {
          status: "failed",
          partnerMessage: params.message ? String(params.message).slice(0, 500) : "User not verified",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        $unset: { encBlob: "", encIv: "", encTag: "" },
      }
    );
    return { ok: true };
  }

  let passwordPlain = "";
  try {
    passwordPlain = decryptSyndicationPendingSecret(
      String(pending.encBlob),
      String(pending.encIv),
      String(pending.encTag)
    );
  } catch {
    return { ok: false, error: "Could not decrypt stored credentials" };
  }

  const platform = await DB.Models.SyndicationPlatform.findById(pending.platformId).lean();
  if (!platform || platform.status !== "approved") {
    await DB.Models.SyndicationConnectionVerification.updateOne(
      { _id: pending._id },
      { $set: { status: "failed", partnerMessage: "Platform no longer approved", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
    );
    return { ok: false, error: "Platform not available" };
  }

  const dup = await DB.Models.PlatformConnection.findOne({
    userId: pending.userId,
    platformId: pending.platformId,
  }).lean();
  if (dup) {
    await DB.Models.SyndicationConnectionVerification.updateOne(
      { _id: pending._id },
      {
        $set: {
          status: "completed",
          connectionId: dup._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        $unset: { encBlob: "", encIv: "", encTag: "" },
      }
    );
    return { ok: true, duplicate: true };
  }

  const created = await DB.Models.PlatformConnection.create({
    userId: pending.userId,
    platformId: pending.platformId,
    platformKey: platform.platformKey,
    platformName: platform.platformName,
    authType: platform.authType,
    status: "active",
    credentials: {
      email,
      password: passwordPlain,
      externalUserId: params.externalUserId ? String(params.externalUserId).trim() : undefined,
    },
    config: {
      baseUrl: platform.config.baseUrl,
      outboundEnabled: true,
      inboundWebhookEnabled: platform.config.inboundWebhookEnabled !== false,
    },
  });

  await DB.Models.SyndicationConnectionVerification.updateOne(
    { _id: pending._id },
    {
      $set: {
        status: "completed",
        connectionId: created._id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      $unset: { encBlob: "", encIv: "", encTag: "" },
    }
  );

  return { ok: true };
}
