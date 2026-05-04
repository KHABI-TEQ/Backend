/**
 * Public DealSite (public-access) URLs: `https://{publicSlug}.{DEALSITE_ROOT_HOST}`.
 *
 * ## Moving the main company site to `khabiteq.com` while keeping `*.khabiteq.com` DealSites
 *
 * DNS cannot serve two different Vercel projects on the **same hostname**. The apex
 * `khabiteq.com` and each `slug.khabiteq.com` must be routed deliberately:
 *
 * 1. **Main website (logged-in hub, marketing)** — Recommended: `CLIENT_LINK` = `https://www.khabiteq.com`
 *    (or `https://khabiteq.com` if you truly want apex for the main app). Point **apex** and/or **www**
 *    in Namecheap to the **main** Vercel project only.
 *
 * 2. **Public-access / DealSite app** — Vercel project for tenant pages: add domain **`*.khabiteq.com`**
 *    (wildcard). Subdomains like `realhomes.khabiteq.com` resolve here. Set `DEALSITE_ROOT_HOST=khabiteq.com`
 *    on the API (this file’s default) so generated links stay `https://{slug}.khabiteq.com`.
 *
 * 3. **Avoid www being caught by wildcard** — Create an **explicit** `www` record (CNAME/A) to the
 *    **main** project so `www.khabiteq.com` is not ambiguous. Wildcard `*` should only match labels you
 *    do not define explicitly (e.g. `realhomes`, `starlink`).
 *
 * 4. **“Default” page at `https://khabiteq.com`** — If that today is the public-access app, you cannot
 *    also host the main SPA on the same hostname without **one** deployment that routes by path or
 *    host middleware. Typical fix: make the **main** site canonical at `www.khabiteq.com`, redirect
 *    apex `khabiteq.com` → `www`, and host DealSites only on `*.khabiteq.com` (no app on bare apex), **or**
 *    merge both frontends into one Vercel app and route internally.
 *
 * Environment:
 * - `DEALSITE_ROOT_HOST` — hostname only, e.g. `khabiteq.com` (no `https://`, no path). Defaults to `khabiteq.com`.
 * - `CLIENT_LINK` — main web app origin for dashboard links, emails, OAuth (see `clientAppUrl.ts`).
 * - **Admin dashboard** — separate from khabiteq.com: use `ADMIN_CLIENT_LINK` and/or `ADMIN_LOGIN_URL` only
 *   (see admin account creation); never inferred from `DEALSITE_ROOT_HOST`.
 */

/** Hostname for DealSite subdomains only (e.g. `khabiteq.com` → `https://slug.khabiteq.com`). */
export function getDealSiteRootHost(): string {
  const raw = (process.env.DEALSITE_ROOT_HOST || "khabiteq.com").trim();
  const host = raw.replace(/^https?:\/\//, "").split("/")[0].trim().toLowerCase();
  return host || "khabiteq.com";
}

/** Full origin for a tenant public page, e.g. `https://realhomes.khabiteq.com` (no trailing slash). */
export function dealSiteOriginFromPublicSlug(publicSlug: string): string {
  const s = String(publicSlug || "").trim();
  if (!s) return "";
  const host = getDealSiteRootHost();
  return `https://${s}.${host}`;
}
