import { DB } from "../controllers";
import {
  isExpoPushToken,
  isStubPushToken,
  sendToBuyerTokens,
} from "./firebaseAdmin.service";
import type { BuyerNotificationType } from "../models/buyerNotification";

function inferType(subject: string): BuyerNotificationType {
  const s = subject.toLowerCase();
  if (
    s.includes("verification code") ||
    s.includes("password reset") ||
    s.includes("reset code") ||
    s.includes("otp")
  ) {
    return "auth";
  }
  if (s.includes("preference") || s.includes("match")) return "preference";
  if (s.includes("inspection") || s.includes("negotiation") || s.includes("viewing")) {
    return "inspection";
  }
  if (s.includes("document") || s.includes("verification") || s.includes("title")) {
    return "document";
  }
  if (
    s.includes("transaction") ||
    s.includes("registration") ||
    s.includes("certificate") ||
    s.includes("lasrera")
  ) {
    return "transaction";
  }
  return "email";
}

function cleanMessage(text: string, subject: string) {
  const trimmed = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return subject;
  return trimmed.length > 600 ? `${trimmed.slice(0, 597)}…` : trimmed;
}

async function pruneInvalidBuyerTokens(
  buyerId: unknown,
  invalidTokens: string[]
): Promise<void> {
  if (!invalidTokens.length) return;
  const set = new Set(invalidTokens);
  await DB.Models.Buyer.updateOne(
    { _id: buyerId },
    {
      $pull: {
        devices: {
          fcmToken: { $in: [...set] },
        },
      },
    }
  );
}

/**
 * Push a notification to a buyer's registered devices (FCM / Expo).
 * No-op when notifications disabled or no real tokens.
 */
export async function pushToBuyerDevices(input: {
  buyerId: string;
  title: string;
  body: string;
  type?: BuyerNotificationType;
  data?: Record<string, string>;
}): Promise<void> {
  const buyer = await DB.Models.Buyer.findById(input.buyerId).select(
    "devices enableNotifications"
  );
  if (!buyer || buyer.enableNotifications === false) return;

  const tokens = (buyer.devices || [])
    .map((d: any) => String(d.fcmToken || "").trim())
    .filter((t: string) => t && !isStubPushToken(t));

  if (!tokens.length) return;

  try {
    const result = await sendToBuyerTokens(tokens, {
      title: input.title,
      body: input.body,
      data: {
        type: input.type || "email",
        screen: "notifications",
        ...(input.data || {}),
      },
    });
    if (result.invalidTokens.length) {
      await pruneInvalidBuyerTokens(buyer._id, result.invalidTokens);
    }
  } catch (err) {
    console.warn("[BuyerNotification] Push failed:", (err as Error).message);
  }
}

/**
 * Mirror an outbound email into the buyer's in-app inbox (and push if devices exist).
 * No-op when the recipient is not a known Buyer.
 * Auth/OTP emails are stored in-inbox but do not trigger device push (avoid OTP spam).
 */
export async function mirrorEmailToBuyerInbox(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const email = String(input.to || "")
    .toLowerCase()
    .trim();
  if (!email || !email.includes("@")) return;

  const buyer = await DB.Models.Buyer.findOne({ email }).select(
    "_id devices enableNotifications email"
  );
  if (!buyer) return;

  const title = String(input.subject || "Khabi-Teq update").trim();
  const message = cleanMessage(input.text, title);
  const type = inferType(title);

  await DB.Models.BuyerNotification.create({
    buyer: buyer._id,
    title,
    message,
    type,
    emailSubject: title,
    isRead: false,
    meta: { source: "email" },
  });

  // OTP / password-reset codes stay email + inbox only.
  if (type === "auth") return;
  if (buyer.enableNotifications === false) return;

  const tokens = (buyer.devices || [])
    .map((d: any) => String(d.fcmToken || "").trim())
    .filter(
      (t: string) =>
        !!t &&
        !isStubPushToken(t) &&
        (isExpoPushToken(t) || t.length > 20)
    );

  if (!tokens.length) return;

  try {
    const result = await sendToBuyerTokens(tokens, {
      title,
      body: message,
      data: { type, screen: "notifications" },
    });
    if (result.invalidTokens.length) {
      await pruneInvalidBuyerTokens(buyer._id, result.invalidTokens);
    }
  } catch (err) {
    console.warn(
      "[BuyerNotification] Push failed:",
      (err as Error).message
    );
  }
}

export async function listBuyerNotifications(
  buyerId: string,
  opts: { page?: number; limit?: number; unreadOnly?: boolean } = {}
) {
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  const filter: Record<string, unknown> = { buyer: buyerId };
  if (opts.unreadOnly) filter.isRead = false;

  const [total, unreadCount, data] = await Promise.all([
    DB.Models.BuyerNotification.countDocuments(filter),
    DB.Models.BuyerNotification.countDocuments({
      buyer: buyerId,
      isRead: false,
    }),
    DB.Models.BuyerNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    data,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getBuyerUnreadCount(buyerId: string) {
  return DB.Models.BuyerNotification.countDocuments({
    buyer: buyerId,
    isRead: false,
  });
}

export async function markBuyerNotificationRead(
  buyerId: string,
  notificationId: string
) {
  const doc = await DB.Models.BuyerNotification.findOneAndUpdate(
    { _id: notificationId, buyer: buyerId },
    { isRead: true },
    { new: true }
  );
  return doc;
}

export async function markAllBuyerNotificationsRead(buyerId: string) {
  const result = await DB.Models.BuyerNotification.updateMany(
    { buyer: buyerId, isRead: false },
    { isRead: true }
  );
  return result.modifiedCount || 0;
}
