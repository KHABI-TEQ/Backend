import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app: App | null = null;
let attempted = false;

/**
 * Initialize Firebase Admin when service-account env vars are present.
 * Safe to call repeatedly. Token storage does not require Firebase;
 * this prepares the app for future push sends.
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
      "[Firebase] Admin not configured. Device tokens will still be stored."
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
    return app;
  } catch (err) {
    console.warn("[Firebase] Init failed:", (err as Error).message);
    return null;
  }
}

/**
 * Send a data/notification message to all FCM tokens for a buyer (future use).
 */
export async function sendToBuyerTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<{ successCount: number; failureCount: number }> {
  const fbApp = ensureFirebaseAdmin();
  if (!fbApp || !tokens.length) {
    return { successCount: 0, failureCount: tokens.length };
  }

  const response = await getMessaging(fbApp).sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}
