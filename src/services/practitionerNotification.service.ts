import { DB } from "../controllers";
import { isStubPushToken, sendToBuyerTokens } from "./firebaseAdmin.service";
import {
  metaToPushData,
  type InboxDeepLinkMeta,
} from "../utils/notificationDeepLinks";

async function pruneInvalidUserTokens(
  userId: unknown,
  invalidTokens: string[]
): Promise<void> {
  if (!invalidTokens.length) return;
  const set = new Set(invalidTokens);
  await DB.Models.User.updateOne(
    { _id: userId },
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
 * Push to a practitioner's registered devices (FCM / Expo).
 * No-op when notifications are disabled or no real tokens exist.
 */
export async function pushToPractitionerDevices(input: {
  userId: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, string>;
  meta?: InboxDeepLinkMeta;
}): Promise<void> {
  const user = await DB.Models.User.findById(input.userId).select(
    "devices enableNotifications"
  );
  if (!user || user.enableNotifications === false) return;

  const tokens = ((user as any).devices || [])
    .map((d: any) => String(d.fcmToken || "").trim())
    .filter((t: string) => t && !isStubPushToken(t));

  if (!tokens.length) return;

  const data = input.data
    ? input.data
    : metaToPushData(input.meta || { audience: "practitioner" }, input.type || "general");

  try {
    const result = await sendToBuyerTokens(tokens, {
      title: input.title,
      body: input.body,
      data: {
        type: input.type || "general",
        audience: "practitioner",
        ...data,
      },
    });
    if (result.invalidTokens.length) {
      await pruneInvalidUserTokens(user._id, result.invalidTokens);
    }
  } catch (err) {
    console.warn("[PractitionerNotification] Push failed:", (err as Error).message);
  }
}
