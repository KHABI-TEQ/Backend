import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";

let app: App | null = null;
let attempted = false;

const STUB_PREFIXES = [
  "expo-go-token-",
  "dev-simulator-token-",
  "no-permission-token-",
  "fallback-token-",
] as const;

export function isStubPushToken(token: string): boolean {
  const t = String(token || "").trim();
  if (!t) return true;
  return STUB_PREFIXES.some((p) => t.startsWith(p));
}

export function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(String(token || "").trim());
}

export function isFirebaseReady(): boolean {
  return !!ensureFirebaseAdmin();
}

/**
 * Initialize Firebase Admin when service-account env vars are present.
 * Safe to call repeatedly. Token storage does not require Firebase;
 * sending push requires credentials.
 */
export function ensureFirebaseAdmin(): App | null {
  if (attempted) {
    return app;
  }
  attempted = true;

  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        app = initializeApp({
          credential: cert(sa),
        });
        console.log("[Firebase] Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON");
        return app;
      } catch (err) {
        console.warn(
          "[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
          (err as Error).message
        );
        return null;
      }
    }

    console.warn(
      "[Firebase] Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON). Device tokens will still be stored."
    );
    return null;
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  try {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log("[Firebase] Admin initialized for project", projectId);
    return app;
  } catch (err) {
    console.warn("[Firebase] Init failed:", (err as Error).message);
    return null;
  }
}

export type PushSendResult = {
  successCount: number;
  failureCount: number;
  /** Tokens that should be removed from the buyer record. */
  invalidTokens: string[];
};

async function sendViaExpoPush(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<PushSendResult> {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    channelId: "default",
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const json: any = await res.json().catch(() => null);
    const tickets = Array.isArray(json?.data) ? json.data : [];
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    tickets.forEach((ticket: any, i: number) => {
      if (ticket?.status === "ok") {
        successCount += 1;
        return;
      }
      failureCount += 1;
      const err = String(ticket?.details?.error || ticket?.message || "");
      if (
        err.includes("DeviceNotRegistered") ||
        err.includes("InvalidCredentials")
      ) {
        invalidTokens.push(tokens[i]);
      }
    });

    if (!tickets.length && !res.ok) {
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
      };
    }

    return { successCount, failureCount, invalidTokens };
  } catch (err) {
    console.warn("[ExpoPush] Send failed:", (err as Error).message);
    return {
      successCount: 0,
      failureCount: tokens.length,
      invalidTokens: [],
    };
  }
}

async function sendViaFirebase(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<PushSendResult> {
  const fbApp = ensureFirebaseAdmin();
  if (!fbApp || !tokens.length) {
    return {
      successCount: 0,
      failureCount: tokens.length,
      invalidTokens: [],
    };
  }

  const data: Record<string, string> = {};
  if (payload.data) {
    for (const [k, v] of Object.entries(payload.data)) {
      data[k] = v == null ? "" : String(v);
    }
  }

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data,
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        sound: "default",
        priority: "high",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
          contentAvailable: true,
        },
      },
    },
  };

  const response = await getMessaging(fbApp).sendEachForMulticast(message);
  const invalidTokens: string[] = [];

  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code || "";
    if (
      code.includes("registration-token-not-registered") ||
      code.includes("invalid-registration-token") ||
      code.includes("invalid-argument")
    ) {
      invalidTokens.push(tokens[i]);
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}

/**
 * Send a notification to buyer device tokens.
 * - Native FCM / APNs-registration tokens → Firebase Admin
 * - ExponentPushToken[...] → Expo Push API (iOS-friendly Expo builds)
 * Stub / simulator tokens are ignored.
 */
export async function sendToBuyerTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<PushSendResult> {
  const unique = [...new Set(tokens.map((t) => String(t || "").trim()).filter(Boolean))];
  const real = unique.filter((t) => !isStubPushToken(t));
  if (!real.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const expoTokens = real.filter(isExpoPushToken);
  const fcmTokens = real.filter((t) => !isExpoPushToken(t));

  if (fcmTokens.length && !ensureFirebaseAdmin()) {
    console.warn(
      "[Firebase] Skipping FCM send — Admin not configured. Set FIREBASE_* env vars."
    );
  }

  const [fcmResult, expoResult] = await Promise.all([
    fcmTokens.length && ensureFirebaseAdmin()
      ? sendViaFirebase(fcmTokens, payload)
      : Promise.resolve({
          successCount: 0,
          failureCount: fcmTokens.length && !ensureFirebaseAdmin() ? fcmTokens.length : 0,
          invalidTokens: [] as string[],
        }),
    expoTokens.length
      ? sendViaExpoPush(expoTokens, payload)
      : Promise.resolve({
          successCount: 0,
          failureCount: 0,
          invalidTokens: [] as string[],
        }),
  ]);

  return {
    successCount: fcmResult.successCount + expoResult.successCount,
    failureCount: fcmResult.failureCount + expoResult.failureCount,
    invalidTokens: [
      ...fcmResult.invalidTokens,
      ...expoResult.invalidTokens,
    ],
  };
}
