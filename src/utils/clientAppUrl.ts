/**
 * Frontend base URL from CLIENT_LINK (no trailing slash).
 */
export function getClientBaseUrl(): string {
  return (process.env.CLIENT_LINK || "").replace(/\/$/, "");
}

/**
 * Logged-in hub: `{CLIENT_LINK}/dashboard`.
 * Emails use this so the SPA can send users through login when the session expired, then route as needed.
 */
export function getClientDashboardUrl(): string {
  const base = getClientBaseUrl();
  return base ? `${base}/dashboard` : "#";
}
