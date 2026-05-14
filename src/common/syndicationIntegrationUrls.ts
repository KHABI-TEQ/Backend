/**
 * Public API base (same rules as property syndication links).
 * `API_BASE_URL` / `CLIENT_LINK` may be `https://host` or `https://host/api`.
 */
export function publicApiBaseUrl(): string {
  const raw = String(process.env.API_BASE_URL || process.env.CLIENT_LINK || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  if (/\/api$/i.test(raw)) return raw;
  return `${raw}/api`;
}

/** Partner → hub listing lifecycle webhook (per platform key). */
export function syndicationListingInboundWebhookUrl(platformKey: string): string {
  const base = publicApiBaseUrl();
  if (!base) return "";
  const pk = encodeURIComponent(String(platformKey).trim().toLowerCase());
  return `${base}/third-party/syndication/webhooks/${pk}`;
}

/** Partner → hub user authentication result (credential verification callback). */
export function syndicationUserAuthenticationWebhookUrl(): string {
  const base = publicApiBaseUrl();
  if (!base) return "";
  return `${base}/syndication/user/authentication/webhook`;
}

/** Plain-text appendix for partner onboarding / approval emails. */
export function buildSyndicationIntegrationAppendixText(params: {
  platformKey: string;
  hubBase: string;
  listingWebhookUrl: string;
  authWebhookUrl: string;
  webhookSecretConfigured: boolean;
}): string {
  const lines = [
    "Khabi-Teq — Syndication integration reference",
    "===========================================",
    "",
    `Registered platform key: ${params.platformKey}`,
    `Hub API base URL: ${params.hubBase || "(not configured)"}`,
    "",
    "1) Listing lifecycle webhooks (optional)",
    `POST ${params.listingWebhookUrl || "(not configured)"}`,
    "   Include header x-platform-signature when Khabi-Teq enables signing (HMAC-SHA256 of raw JSON body).",
    "",
    "2) User authentication callback (required for partner_login connections)",
    `POST ${params.authWebhookUrl || "(not configured)"}`,
    "   After your login API validates the JSON body { email, password } from Khabi-Teq’s verification POST,",
    "   call this URL with Content-Type: application/json.",
    "",
    "   Khabi-Teq verification POST to your platform:",
    "   - URL: SyndicationPlatform.config.loginUrl if set, otherwise config.baseUrl",
    "   - Headers: X-Khabiteq-Correlation-Id (UUID), X-Khabiteq-Platform-Key (platform key)",
    "   - Body: { \"email\": \"...\", \"password\": \"...\" } only",
    "",
    "   Your callback JSON (camelCase):",
    "   - success (boolean, required)",
    "   - verified (boolean, required)",
    "   - correlationId (string, required) — echo X-Khabiteq-Correlation-Id",
    "   - email (string, required) — lowercase, echo request body",
    "   - platformKey (string, required) — echo X-Khabiteq-Platform-Key",
    "   - message (string | null, optional)",
    "   - externalUserId (string | null, optional) — your stable user id when verified is true",
    "",
    params.webhookSecretConfigured
      ? "3) Signing: when SYNDICATION_WEBHOOK_SECRET is set on the hub, sign listing webhooks and this auth callback with header x-platform-signature = hex(HMAC-SHA256(JSON body))."
      : "3) Signing: optional in this environment; the hub may enable signing later.",
    "",
    "— Khabi-Teq",
  ];
  return lines.join("\n");
}
