import { getDealSiteRootHost } from "../../config/dealSitePublicHost";
import { getClientBaseUrl } from "../../utils/clientAppUrl";

/** Bump when the email logo asset changes (cache-bust query param). */
export const KHABITEQ_EMAIL_LOGO_VERSION = "20260615-centered";

/** Header — horizontal wordmark (icon + black KHABI-TEQ). */
export const KHABITEQ_EMAIL_HEADER_LOGO_FILENAME = "khabiteq-logo-header.png";

/** Footer — white KHABI-TEQ wordmark on dark backgrounds. */
export const KHABITEQ_EMAIL_FOOTER_LOGO_FILENAME = "khabiteq-logo-footer-trimmed.png";

/** API static origin (strip trailing `/api` from API_BASE_URL / BACKEND_URL). */
function getApiServerOrigin(): string {
  const raw = String(process.env.API_BASE_URL || process.env.BACKEND_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!raw) return "";
  return raw.replace(/\/api$/i, "");
}

function resolveBrandAssetUrl(
  filename: string,
  envOverride?: string,
): string {
  const override = (envOverride || "").trim();
  if (override) return override;

  const cacheBust = `?v=${KHABITEQ_EMAIL_LOGO_VERSION}`;
  const path = `/${filename}${cacheBust}`;

  const apiOrigin = getApiServerOrigin();
  if (apiOrigin) return `${apiOrigin}${path}`;

  const clientBase = getClientBaseUrl();
  if (clientBase) return `${clientBase}${path}`;

  return `https://www.${getDealSiteRootHost()}${path}`;
}

/** Absolute URL for the header wordmark in outbound email HTML. */
export function getKhabiteqEmailLogoUrl(): string {
  return resolveBrandAssetUrl(
    KHABITEQ_EMAIL_HEADER_LOGO_FILENAME,
    process.env.KHABITEQ_EMAIL_LOGO_URL,
  );
}

/** Absolute URL for the white footer wordmark in outbound email HTML. */
export function getKhabiteqEmailFooterLogoUrl(): string {
  return resolveBrandAssetUrl(
    KHABITEQ_EMAIL_FOOTER_LOGO_FILENAME,
    process.env.KHABITEQ_EMAIL_FOOTER_LOGO_URL,
  );
}

export const KHABITEQ_EMAIL_LOGO_ALT = "Khabiteq";
