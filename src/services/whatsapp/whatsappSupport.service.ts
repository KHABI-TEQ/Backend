import { DB } from "../../controllers";
import { phoneVariantsForLookup } from "../../common/phoneUtils";
import { getWhatsappSessionMessaging } from "./whatsappSessionMessaging.service";
import type { ChannelSessionStep } from "../../models/channelSession";

export interface WhatsappSupportMessage {
  direction: "inbound" | "outbound";
  body: string;
  at: string;
  adminId?: string;
  adminName?: string;
}

export async function appendWhatsappSupportMessage(
  phone: string,
  message: WhatsappSupportMessage
): Promise<void> {
  const sessionId = `wa:${phone}`;
  await DB.Models.ChannelSession.findOneAndUpdate(
    { channel: "whatsapp", sessionId },
    {
      $push: {
        "context.messages": {
          $each: [message],
          $slice: -100,
        },
      },
    },
    { upsert: true }
  );
}

export async function listAwaitingHumanSessions(params: {
  page?: number;
  limit?: number;
  step?: ChannelSessionStep;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const step = params.step || "awaiting_human";

  const filter = { channel: "whatsapp", step };

  const [items, total] = await Promise.all([
    DB.Models.ChannelSession.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DB.Models.ChannelSession.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getWhatsappSupportSession(phone: string) {
  const variants = phoneVariantsForLookup(phone);
  const session = await DB.Models.ChannelSession.findOne({
    channel: "whatsapp",
    $or: [
      { phoneNumber: { $in: variants } },
      ...variants.map((v) => ({ sessionId: `wa:${v}` })),
    ],
  }).lean();

  return session;
}

export async function replyToWhatsappSupportSession(
  phone: string,
  message: string,
  admin: { id: string; name?: string }
): Promise<{ success: boolean; error?: string }> {
  const wa = getWhatsappSessionMessaging();
  if (!wa) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const result = await wa.sendText(phone, message);
  if (!result.success) {
    return { success: false, error: result.error || "Send failed" };
  }

  await appendWhatsappSupportMessage(phone, {
    direction: "outbound",
    body: message,
    at: new Date().toISOString(),
    adminId: admin.id,
    adminName: admin.name,
  });

  return { success: true };
}

export async function resolveWhatsappSupportSession(phone: string): Promise<void> {
  const session = await getWhatsappSupportSession(phone);
  if (!session) return;

  const expiresAt = new Date(Date.now() + Number(process.env.WHATSAPP_BOT_SESSION_TTL_MS || 86_400_000));

  await DB.Models.ChannelSession.findOneAndUpdate(
    { _id: session._id },
    {
      step: "main",
      expiresAt,
      $push: {
        "context.messages": {
          $each: [
            {
              direction: "outbound",
              body: "[Session resolved by support]",
              at: new Date().toISOString(),
            },
          ],
          $slice: -100,
        },
      },
    }
  );
}

export async function countAwaitingHumanSessions(): Promise<number> {
  return DB.Models.ChannelSession.countDocuments({
    channel: "whatsapp",
    step: "awaiting_human",
  });
}
