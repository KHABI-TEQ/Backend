import { getDealSiteRootHost } from "../config/dealSitePublicHost";

/**
 * Frontend base URL from CLIENT_LINK (no trailing slash).
 */
export function getClientBaseUrl(): string {
  return (process.env.CLIENT_LINK || "").replace(/\/$/, "");
}

/**
 * Main web app sign-in URL (dashboard app on CLIENT_LINK, not a DealSite subdomain).
 * If CLIENT_LINK is unset, falls back to `https://www.{DEALSITE_ROOT_HOST}/login` (typical when apex
 * serves marketing and `www` serves the app — adjust CLIENT_LINK if your app lives only on apex).
 */
export function getMainWebLoginUrl(): string {
  const base = getClientBaseUrl();
  if (base) return `${base}/login`;
  return `https://www.${getDealSiteRootHost()}/login`;
}

/**
 * Logged-in hub: `{CLIENT_LINK}/dashboard`.
 * Emails use this so the SPA can send users through login when the session expired, then route as needed.
 */
export function getClientDashboardUrl(): string {
  const base = getClientBaseUrl();
  return base ? `${base}/dashboard` : "#";
}
