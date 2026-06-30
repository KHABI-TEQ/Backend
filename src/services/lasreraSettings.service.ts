import fs from "fs";
import path from "path";
import { DB } from "../controllers";

export const LASRERA_SETTINGS_KEY = "lasrera_certificate_config";

/** @deprecated Use bundled asset or uploaded Cloudinary URL */
export const DEFAULT_LASRERA_LOGO_URL =
  "https://lasrera.lagosstate.gov.ng/images/lasrera_logo.png";

export interface ILasreraCertificateConfig {
  logoUrl: string;
  stampUrl?: string;
  signatureUrl?: string;
  signatoryName: string;
  signatoryTitle: string;
}

export type ILasreraCertificateConfigResponse = ILasreraCertificateConfig & {
  isPersisted: boolean;
};

const DEFAULT_CONFIG: ILasreraCertificateConfig = {
  logoUrl: "",
  stampUrl: "",
  signatureUrl: "",
  signatoryName: "Director General",
  signatoryTitle: "Lagos State Real Estate Regulatory Authority",
};

const BUNDLED_LOGO_CANDIDATES = [
  path.join(process.cwd(), "src/assets/lasrera_logo.webp"),
  path.join(__dirname, "../assets/lasrera_logo.webp"),
];

export function readBundledLasreraLogo(): Buffer | null {
  for (const candidate of BUNDLED_LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    } catch {
      /* try next path */
    }
  }
  return null;
}

function normalizeStoredUrl(url?: string): string {
  const trimmed = url?.trim() || "";
  if (!trimmed || trimmed === DEFAULT_LASRERA_LOGO_URL) return "";
  return trimmed;
}

export async function getLasreraCertificateConfig(): Promise<ILasreraCertificateConfigResponse> {
  const row = await DB.Models.SystemSetting.findOne({
    key: LASRERA_SETTINGS_KEY,
    status: "active",
  }).lean();

  if (!row?.value || typeof row.value !== "object") {
    return { ...DEFAULT_CONFIG, isPersisted: false };
  }

  const value = row.value as Partial<ILasreraCertificateConfig>;
  return {
    logoUrl: normalizeStoredUrl(value.logoUrl),
    stampUrl: normalizeStoredUrl(value.stampUrl),
    signatureUrl: normalizeStoredUrl(value.signatureUrl),
    signatoryName: value.signatoryName?.trim() || DEFAULT_CONFIG.signatoryName,
    signatoryTitle: value.signatoryTitle?.trim() || DEFAULT_CONFIG.signatoryTitle,
    isPersisted: true,
  };
}

export async function updateLasreraCertificateConfig(
  patch: Partial<ILasreraCertificateConfig>
): Promise<ILasreraCertificateConfigResponse> {
  const current = await getLasreraCertificateConfig();
  const next: ILasreraCertificateConfig = {
    logoUrl:
      patch.logoUrl !== undefined
        ? normalizeStoredUrl(patch.logoUrl)
        : current.logoUrl,
    stampUrl:
      patch.stampUrl !== undefined
        ? normalizeStoredUrl(patch.stampUrl)
        : current.stampUrl || "",
    signatureUrl:
      patch.signatureUrl !== undefined
        ? normalizeStoredUrl(patch.signatureUrl)
        : current.signatureUrl || "",
    signatoryName: patch.signatoryName?.trim() || current.signatoryName,
    signatoryTitle: patch.signatoryTitle?.trim() || current.signatoryTitle,
  };

  await DB.Models.SystemSetting.findOneAndUpdate(
    { key: LASRERA_SETTINGS_KEY },
    {
      key: LASRERA_SETTINGS_KEY,
      value: next,
      description: "LASRERA transaction registration certificate branding and signature",
      category: "lasrera",
      isEditable: true,
      status: "active",
    },
    { upsert: true, new: true }
  );

  return { ...next, isPersisted: true };
}
