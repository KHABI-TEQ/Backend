import { DB } from "../controllers";
import {
  isExpoPushToken,
  isStubPushToken,
  sendToBuyerTokens,
} from "./firebaseAdmin.service";
import type { BuyerNotificationType } from "../models/buyerNotification";
import {
  extractDeepLinkMetaFromContent,
  metaToPushData,
  type InboxDeepLinkMeta,
} from "../utils/notificationDeepLinks";

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
 * Create a buyer inbox item + push with structured deep-link meta (no email required).
 */
export async function createBuyerInboxNotification(input: {
  buyerId: string;
  title: string;
  message: string;
  type?: BuyerNotificationType;
  meta?: InboxDeepLinkMeta;
}): Promise<void> {
  const buyer = await DB.Models.Buyer.findById(input.buyerId).select(
    "_id devices enableNotifications"
  );
  if (!buyer) return;

  const title = String(input.title || "Khabi-Teq update").trim();
  const message = cleanMessage(input.message, title);
  const type = input.type || inferType(title);
  const meta: InboxDeepLinkMeta = {
    source: "system",
    audience: "buyer",
    ...(input.meta || {}),
  };

  await DB.Models.BuyerNotification.create({
    buyer: buyer._id,
    title,
    message,
    type,
    emailSubject: title,
    isRead: false,
    meta,
  });

  if (type === "auth") return;
  if (buyer.enableNotifications === false) return;

  await pushToBuyerDevices({
    buyerId: String(buyer._id),
    title,
    body: message,
    type,
    data: metaToPushData(meta, type),
  });
}

/**
 * Mirror an outbound email into the buyer's in-app inbox (and push if devices exist).
 * Deep-link meta is stored so the app can open the relevant screen instead of web email links.
 */
export async function mirrorEmailToBuyerInbox(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  meta?: InboxDeepLinkMeta;
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

  const inferred = extractDeepLinkMetaFromContent(
    `${input.html || ""}\n${input.text || ""}`,
    title
  );
  const explicit = input.meta || {};
  const meta: InboxDeepLinkMeta = {
    ...inferred,
    ...explicit,
    source: explicit.source || inferred.source || "email",
  };

  // Never let a generic structured meta wipe a concrete link parsed from the email
  if (inferred.inspectionId && !explicit.inspectionId) {
    meta.inspectionId = inferred.inspectionId;
    meta.actionPath = inferred.actionPath || meta.actionPath;
    meta.screen = inferred.screen || meta.screen;
  }
  if (inferred.documentVerificationId && !explicit.documentVerificationId) {
    meta.documentVerificationId = inferred.documentVerificationId;
    meta.actionPath = inferred.actionPath || meta.actionPath;
    meta.screen = inferred.screen || meta.screen;
  }

  // Prefer buyer-facing screens when audience is ambiguous
  if (!meta.screen && type === "inspection") {
    meta.screen = "inspection";
    meta.actionPath = meta.actionPath || "/inspections";
  }

  await DB.Models.BuyerNotification.create({
    buyer: buyer._id,
    title,
    message,
    type,
    emailSubject: title,
    isRead: false,
    meta,
  });

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
      data: metaToPushData(meta, type),
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
